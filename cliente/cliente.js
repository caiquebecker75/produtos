/* =====================================================================
   Página do cliente: acompanhamento ao vivo de uma campanha, sem login.

   O endereço carrega um token (?c=...). Ele abre o documento do link em
   compartilhamentos/{token}; as regras do Firestore só entregam esse
   documento enquanto o link estiver ativo e dentro da validade, e só
   deixam ler os registros dos projetos que o painel marcou em publicos.
   Se a equipe bloquear o link com a página aberta, a tela muda na hora:
   o documento do link também é lido em tempo real.
   ===================================================================== */
import { firebaseConfig, FIREBASE_SDK } from '../assets/firebase-config.js?v=1';
import { estiloProjeto, htmlMarcador } from '../painel/marcadores.js?v=1';
import { calcular, recorte, insights, bandeiraDe } from '../painel/inteligencia.js?v=3';
import * as G from '../painel/graficos.js?v=2';

const [{ initializeApp }, F] = await Promise.all([
  import(`${FIREBASE_SDK}/firebase-app.js`),
  import(`${FIREBASE_SDK}/firebase-firestore.js`),
]);

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Number(n || 0).toLocaleString('pt-BR');
const dataFmt = (dt) => (dt ? dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const diaFmt = (dt) => (dt ? dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '');
const telas = (nome) => ['carregando', 'fechada', 'cliente'].forEach((t) => { $(`#tela-${t}`).hidden = t !== nome; });

const db = F.getFirestore(initializeApp(firebaseConfig));
const token = new URLSearchParams(location.search).get('c') || location.hash.replace('#', '');

let link = null;
let catalogo = [];
let porProjeto = new Map();   // slug → registros
let paradas = [];             // desliga os ouvintes quando o link cai
let mapa, camada;
let recorteAtual = 'bandeira';
let visitaContada = false;

const registros = () => [...porProjeto.values()].flat().sort((a, b) => (b.data?.getTime() || 0) - (a.data?.getTime() || 0));

let tentarDeNovo = null;
function fechar(titulo, texto) {
  paradas.forEach((p) => p());
  paradas = [];
  link = null;
  $('#fechada-tit').textContent = titulo;
  $('#fechada-txt').textContent = texto;
  telas('fechada');
  // se a equipe reativar o link, a página volta sozinha: tenta de novo de meio em meio minuto
  clearTimeout(tentarDeNovo);
  if (token) tentarDeNovo = setTimeout(ouvirLink, 30000);
}

function nomeProjeto(slug) {
  const c = catalogo.find((p) => p.slug === slug);
  const r = porProjeto.get(slug)?.[0];
  return { nome: c?.nome || r?.projetoNome || slug, cliente: c?.cliente || r?.cliente || '' };
}

function nomePeca(slug, id) {
  const c = catalogo.find((p) => p.slug === slug);
  return c?.pecas?.find((x) => x.id === id)?.nome || id;
}

/* ------------------------------------------------------------------ início */

function ouvirLink() {
  paradas.forEach((p) => p());
  paradas = [];
  paradas.push(F.onSnapshot(F.doc(db, 'compartilhamentos', token), (snap) => {
    if (!snap.exists()) {
      return fechar('Link encerrado', 'Este acompanhamento não está mais disponível. Fale com o seu contato na 75 LAB para receber um link novo.');
    }
    const d = snap.data();
    const venceu = d.expiraEm && d.expiraEm.toMillis() < Date.now();
    if (!d.ativo || venceu) {
      return fechar(venceu ? 'Link vencido' : 'Acesso encerrado',
        venceu ? 'O prazo deste acompanhamento terminou. Fale com o seu contato na 75 LAB para receber um link novo.'
               : 'O acesso a este acompanhamento foi encerrado pela 75 LAB.');
    }
    const mudouProjetos = !link || link.projetos.join() !== d.projetos.join();
    link = { id: snap.id, ...d };
    desenharCabecalho();
    if (mudouProjetos) ouvirProjetos();
    contarVisita();
    telas('cliente');
  }, (e) => {
    console.error(e);
    fechar('Link encerrado', 'Este acompanhamento não está mais disponível. Fale com o seu contato na 75 LAB para receber um link novo.');
  }));
}

if (!token) {
  fechar('Link inválido', 'O endereço veio sem o código do acompanhamento. Peça o link completo ao seu contato na 75 LAB.');
} else {
  try { catalogo = await (await fetch('../projetos.json', { cache: 'no-store' })).json(); } catch { catalogo = []; }
  ouvirLink();
}

async function contarVisita() {
  if (visitaContada) return;
  visitaContada = true;
  try {
    await F.updateDoc(F.doc(db, 'compartilhamentos', token), {
      visitas: F.increment(1), ultimoAcesso: F.serverTimestamp(),
    });
  } catch { /* a visita é só informação: se não der, a página segue */ }
}

/** Um ouvinte por campanha: a regra do Firestore exige a consulta filtrada por projeto. */
function ouvirProjetos() {
  paradas.slice(1).forEach((p) => p());
  paradas = paradas.slice(0, 1);
  porProjeto = new Map();
  for (const slug of link.projetos) {
    const q = F.query(F.collection(db, 'instalacoes'), F.where('projeto', '==', slug), F.limit(3000));
    paradas.push(F.onSnapshot(q, (snap) => {
      porProjeto.set(slug, snap.docs.map((d) => {
        const r = d.data({ serverTimestamps: 'estimate' });
        return { id: d.id, ...r, data: r.criadoEm?.toDate?.() || null };
      }));
      desenhar();
    }, (e) => console.error('registros', slug, e)));
  }
}

/* ---------------------------------------------------------------- cabeçalho */

function desenharCabecalho() {
  document.title = `${link.titulo} · 75 LAB`;
  $('#cli-cliente').textContent = link.cliente || '';
  $('#cli-titulo').textContent = link.titulo;
  $('#cli-recado').textContent = link.observacao || '';
  $('#cli-recado').hidden = !link.observacao;
  $('#cli-fachadas-card').hidden = !link.fotos;
}

/* ------------------------------------------------------------------ desenho */

function desenhar() {
  const lista = registros();
  const r = calcular(lista, lista);
  const s = r.resumo;

  $('#cli-atualizado').textContent = lista.length
    ? `Último registro em ${dataFmt(lista[0].data)} · a página se atualiza sozinha`
    : 'Assim que a primeira peça for instalada e o QR lido, os números aparecem aqui.';

  $('#cli-bn').innerHTML = G.bigNumbers([
    { rotulo: 'Lojas positivadas', valor: num(s.pdvs), destaque: true, variacao: r.variacao.pdvs,
      nota: `${num(s.bandeiras)} rede${s.bandeiras === 1 ? '' : 's'} · ${num(s.registros)} registros` },
    { rotulo: 'Peças instaladas', valor: num(s.pecas), variacao: r.variacao.pecas,
      nota: s.pdvs ? `${(s.pecas / s.pdvs).toFixed(1)} por loja` : '' },
    { rotulo: 'Cidades alcançadas', valor: num(new Set(lista.map((x) => x.cidade).filter(Boolean)).size),
      nota: `${num(new Set(lista.map((x) => x.uf).filter(Boolean)).size)} estados` },
    { rotulo: 'Tempo de positivação', valor: s.diasPositivacao == null ? '–' : s.diasPositivacao.toFixed(1),
      unidade: s.diasPositivacao == null ? '' : 'd', nota: 'do início da campanha até a loja' },
    { rotulo: 'Com foto da fachada', valor: s.comFoto == null ? '–' : `${Math.round(s.comFoto)}%`,
      nota: 'prova visual da instalação' },
  ]);

  $('#cli-insights').innerHTML = insights(r, lista, nomeProjeto)
    .filter((i) => !i.alerta)   // o alerta de loja parada é leitura interna da 75 LAB
    .slice(0, 4)
    .map((i) => `<article class="insight"><b>${esc(i.n)}</b><span>${esc(i.t)}</span><small>${esc(i.sub)}</small></article>`).join('');

  $('#cli-ritmo').innerHTML = G.areaRitmo(r.ritmo);
  $('#cli-ritmo-dica').textContent = `${num(r.janela30.registros)} registros nos últimos 30 dias`;

  desenharPecas(lista);
  desenharCobertura(lista, r);
  desenharLojas(r);
  desenharMapa(lista);
  if (link.fotos) desenharFachadas(lista);
}

/* peças instaladas: cada peça de cada loja conta uma vez */
function desenharPecas(lista) {
  const conta = new Map();
  for (const x of lista) {
    const ids = (x.pecas || []).length ? x.pecas : ['peca'];
    for (const p of ids) {
      const nome = p === 'peca' ? nomeProjeto(x.projeto).nome : nomePeca(x.projeto, p);
      if (!conta.has(nome)) conta.set(nome, new Set());
      conta.get(nome).add(`${x.loja}|${x.projeto}|${p}`);
    }
  }
  const linhas = [...conta.entries()].map(([nome, set]) => ({ nome, valor: set.size })).sort((a, b) => b.valor - a.valor);
  $('#cli-pecas').innerHTML = linhas.length
    ? G.donut(linhas.slice(0, 6).map((l, i) => ({ nome: l.nome, valor: l.valor, cor: G.CORES[i % G.CORES.length] })),
        { centro: num(linhas.reduce((a, b) => a + b.valor, 0)), rotulo: 'peças' })
    : '<p class="dica">Nenhuma peça registrada ainda.</p>';
}

function desenharCobertura(lista, r) {
  const linhas = recorte(lista, r.pontoDe, r.pontos, recorteAtual, nomeProjeto);
  $('#cli-barras').innerHTML = G.barras(linhas.slice(0, 10).map((l) => ({
    nome: l.rotulo, valor: l.pdvs, nota: `${num(l.pecas)} peça${l.pecas === 1 ? '' : 's'} instalada${l.pecas === 1 ? '' : 's'}`,
  })));
}

function desenharLojas(r) {
  const pontos = [...r.pontos].sort((a, b) => {
    const ua = Math.max(...a.registros.map((x) => x.data?.getTime() || 0));
    const ub = Math.max(...b.registros.map((x) => x.data?.getTime() || 0));
    return ub - ua;
  });
  $('#cli-lojas-dica').textContent = pontos.length ? `${num(pontos.length)} loja${pontos.length === 1 ? '' : 's'} com peça instalada` : '';
  $('#cli-lojas').innerHTML = pontos.map((p) => {
    const primeiro = p.registros[0];
    const pecas = new Set();
    for (const x of p.registros) for (const id of (x.pecas || [])) pecas.add(nomePeca(x.projeto, id));
    const quem = link.promotores ? [...new Set(p.registros.map((x) => x.nome))].join(', ') : '';
    return `<tr>
      <td><b>${esc(p.nome)}</b><small>${esc(p.bandeira)}${p.cidade ? ` · ${esc(p.cidade)}/${esc(p.uf || '')}` : ''}</small></td>
      <td>${esc([...new Set(p.registros.map((x) => nomeProjeto(x.projeto).nome))].join(' · '))}
        ${pecas.size ? `<small>${esc([...pecas].join(', '))}</small>` : ''}</td>
      <td class="n"><small>${esc(diaFmt(primeiro.data))}</small>${quem ? `<small>${esc(quem)}</small>` : ''}</td>
    </tr>`;
  }).join('') || '<tr><td class="vazio-td">Nenhuma loja positivada ainda.</td></tr>';
}

function desenharMapa(lista) {
  if (!window.L) return setTimeout(() => desenharMapa(registros()), 300);
  const comGeo = lista.filter((x) => x.geo);
  $('#cli-mapa-dica').textContent = comGeo.length ? `${num(comGeo.length)} ponto${comGeo.length === 1 ? '' : 's'} no mapa` : '';
  if (!mapa) {
    mapa = L.map('cli-mapa', { scrollWheelZoom: false }).setView([-15.8, -47.9], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa);
    camada = L.layerGroup().addTo(mapa);
  }
  camada.clearLayers();
  for (const x of comGeo) {
    const icone = L.divIcon({
      className: 'mk-leaflet', html: htmlMarcador(estiloProjeto(x.projeto, catalogo)),
      iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -30],
    });
    L.marker([x.geo.lat, x.geo.lng], { icon: icone, title: x.loja }).addTo(camada).bindPopup(
      `<b>${esc(x.loja)}</b><br>${esc(nomeProjeto(x.projeto).nome)}<br>${esc(diaFmt(x.data))}`);
  }
  if (comGeo.length) mapa.fitBounds(L.latLngBounds(comGeo.map((x) => [x.geo.lat, x.geo.lng])).pad(0.25), { maxZoom: 12 });
}

const cacheFoto = new Map();
async function desenharFachadas(lista) {
  const grade = $('#cli-fachadas');
  const comFoto = lista.filter((x) => x.temFoto).slice(0, 12);
  $('#cli-fachadas-dica').textContent = comFoto.length ? `${num(comFoto.length)} foto${comFoto.length === 1 ? '' : 's'} mais recentes` : '';
  if (!comFoto.length) {
    grade.innerHTML = '<p class="dica">As fotos das fachadas aparecem aqui assim que os promotores registrarem.</p>';
    return;
  }
  grade.innerHTML = comFoto.map((x) => `
    <figure class="fachada" data-foto="${esc(x.id)}">
      <div class="fachada-img"><span class="carregando-foto"></span></div>
      <figcaption><b>${esc(x.loja)}</b><small>${esc(bandeiraDe(x))}${x.cidade ? ` · ${esc(x.cidade)}/${esc(x.uf || '')}` : ''}</small>
        <small>${esc(diaFmt(x.data))}</small></figcaption>
    </figure>`).join('');
  for (const x of comFoto) {
    const caixa = grade.querySelector(`[data-foto="${CSS.escape(x.id)}"] .fachada-img`);
    if (!caixa) continue;
    try {
      let img = cacheFoto.get(x.id);
      if (img === undefined) {
        const snap = await F.getDoc(F.doc(db, 'fotos', x.id));
        img = snap.exists() ? snap.data().img : null;
        cacheFoto.set(x.id, img);
      }
      caixa.innerHTML = img
        ? `<a href="${img}" target="_blank" rel="noopener"><img src="${img}" alt="Fachada de ${esc(x.loja)}" loading="lazy"></a>`
        : '<span class="dica">foto indisponível</span>';
    } catch {
      caixa.innerHTML = '<span class="dica">foto indisponível</span>';
    }
  }
}

$('#cli-abas').addEventListener('click', (e) => {
  const b = e.target.closest('[data-recorte]');
  if (!b) return;
  recorteAtual = b.dataset.recorte;
  $('#cli-abas').querySelectorAll('.aba').forEach((x) => x.classList.toggle('sel', x === b));
  const lista = registros();
  desenharCobertura(lista, calcular(lista, lista));
});
