// Painel de instalações 75 LAB — lê Firestore/instalacoes em tempo real (só contas @75lab.com.br).
import { firebaseConfig, FIREBASE_SDK } from '../assets/firebase-config.js?v=1';
import { hashSenha, normalizarSenha } from '../assets/senha.js?v=1';
import { estiloProjeto, htmlMarcador } from './marcadores.js?v=1';
import { desenhar as desenharIntel, desenharFachadas, completarCidades } from './inteligencia.js?v=4';
import { iniciarLinks, pararLinks } from './links.js?v=2';
import { marcarEquipe } from '../assets/equipe.js?v=1';

const [{ initializeApp }, A, F] = await Promise.all([
  import(`${FIREBASE_SDK}/firebase-app.js`),
  import(`${FIREBASE_SDK}/firebase-auth.js`),
  import(`${FIREBASE_SDK}/firebase-firestore.js`),
]);

const app = initializeApp(firebaseConfig);
const auth = A.getAuth(app);
const db = F.getFirestore(app);
const DOMINIO = '@75lab.com.br';
const BASE_PAGINAS = new URL('../', location.href).href;

const $ = (s) => document.querySelector(s);
const IC = {
  abrir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14h1M14 20h3M20 17v4" stroke-linecap="round"/></svg>',
  ajustes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>',
  filtro: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>',
  olho: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const telFmt = (d) => (d?.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d?.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : d || '');
const dataFmt = (dt) => dt ? dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'enviando…';
const telas = (nome) => ['login', 'carregando', 'painel'].forEach((t) => { $(`#tela-${t}`).hidden = t !== nome; });

let toastT;
function toast(msg) {
  const el = $('.toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), 4000);
}

// ---------------------------------------------------------------- login
$('#entrar').addEventListener('click', async () => {
  const provider = new A.GoogleAuthProvider();
  provider.setCustomParameters({ hd: '75lab.com.br', prompt: 'select_account' });
  $('#login-erro').hidden = true;
  try {
    await A.signInWithPopup(auth, provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
      return A.signInWithRedirect(auth, provider);
    }
    if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
      $('#login-erro').textContent = e.code === 'auth/unauthorized-domain'
        ? 'Este endereço ainda não está autorizado no Firebase (Authentication → Configurações → Domínios autorizados).'
        : `Não foi possível entrar (${e.code || e.message}).`;
      $('#login-erro').hidden = false;
    }
  }
});
$('#sair').addEventListener('click', () => A.signOut(auth));

let pararLeitura = null;
let pararSenhas = null;
let pararPaginas = null;
let pararAcessos = null;
let usuarioEmail = '';
A.onAuthStateChanged(auth, async (user) => {
  pararLeitura?.();
  pararSenhas?.();
  pararPaginas?.();
  pararAcessos?.();
  pararLinks();
  pararLeitura = pararSenhas = pararPaginas = pararAcessos = null;
  if (!user) return telas('login');
  if (!user.email?.toLowerCase().endsWith(DOMINIO) || !user.emailVerified) {
    await A.signOut(auth);
    $('#login-erro').textContent = `A conta ${user.email} não tem acesso. Entre com o seu e-mail ${DOMINIO}.`;
    $('#login-erro').hidden = false;
    return telas('login');
  }
  $('#usuario').textContent = user.email;
  usuarioEmail = user.email;
  marcarEquipe(user.email); // libera a prévia das páginas neste navegador por 12 h
  telas('painel');
  iniciar();
});

// ---------------------------------------------------------------- dados
let registros = [];
let catalogo = [];
let mapa, camada;
let acessos = [];         // pulso das páginas: { projeto, etapa, origem, sessao, so, data }
let paginas = {};         // slug → { ativo, atualizadoEm/Por, semSenha, semSenhaEm/Por, pecasOff[], pecasOffEm/Por }
let senhas = {};          // slug → { senha, atualizadoEm, atualizadoPor }
let editando = null;      // slug com o campo de senha aberto
let rascunho = '';
const visiveis = new Set();

async function iniciar() {
  try { catalogo = await (await fetch('../projetos.json', { cache: 'no-store' })).json(); } catch { catalogo = []; }
  iniciarLinks({
    F, db, email: usuarioEmail, toast, dataFmt, nomeProjeto,
    catalogo: () => [...catalogo].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  });
  pararPaginas = F.onSnapshot(F.collection(db, 'paginas'), (snap) => {
    paginas = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
    if (!editando) desenhar();
  }, (e) => console.error(e));
  // pulso das páginas (quem abriu, mesmo sem registrar): só existe a partir de 27/10/2026
  pararAcessos = F.onSnapshot(
    F.query(F.collection(db, 'acessos'), F.orderBy('criadoEm', 'desc'), F.limit(5000)),
    (snap) => {
      acessos = snap.docs.map((d) => {
        const a = d.data({ serverTimestamps: 'estimate' });
        return { ...a, data: a.criadoEm?.toDate?.() || null };
      });
      if (!editando) desenhar();
    },
    (e) => console.error('acessos', e),
  );
  pararSenhas = F.onSnapshot(F.collection(db, 'senhas'), (snap) => {
    senhas = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
    if (!editando) desenhar();
  }, (e) => console.error(e));
  const q = F.query(F.collection(db, 'instalacoes'), F.orderBy('criadoEm', 'desc'), F.limit(5000));
  pararLeitura = F.onSnapshot(q, (snap) => {
    registros = snap.docs.map((d) => {
      const r = d.data({ serverTimestamps: 'estimate' });
      return { id: d.id, ...r, data: r.criadoEm?.toDate?.() || null };
    });
    preencherProjetos();
    if (!editando) desenhar();
    // cidade e estado não vêm no registro: completa uma vez por ponto e grava de volta
    completarCidades({ registros, F, db, aoAtualizar: () => { if (!editando) desenhar(); } });
  }, (e) => {
    console.error(e);
    toast(e.code === 'permission-denied' ? 'Sem permissão para ler os registros.' : 'Erro ao carregar os registros.');
  });
}

function nomeProjeto(slug) {
  const c = catalogo.find((p) => p.slug === slug);
  const r = registros.find((x) => x.projeto === slug);
  return { nome: c?.nome || r?.projetoNome || slug, cliente: c?.cliente || r?.cliente || '' };
}

// enxoval: nomes das peças executadas num registro (catálogo em projetos.json → "pecas")
function nomesPecas(r) {
  if (!Array.isArray(r.pecas) || !r.pecas.length) return [];
  const c = catalogo.find((p) => p.slug === r.projeto);
  return r.pecas.map((id) => c?.pecas?.find((x) => x.id === id)?.nome || id);
}

function preencherPecas() {
  const sel = $('#f-peca');
  const proj = $('#f-projeto').value;
  const atual = sel.value;
  const kits = catalogo.filter((p) => p.pecas?.length && (!proj || p.slug === proj));
  const ops = [];
  kits.forEach((k) => k.pecas.forEach((pc) => ops.push([`${k.slug}:${pc.id}`, kits.length > 1 ? `${pc.nome} · ${k.nome}` : pc.nome])));
  sel.closest('label').hidden = !ops.length;
  sel.innerHTML = '<option value="">Todas as peças</option>' + ops.map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`).join('');
  sel.value = ops.some(([v]) => v === atual) ? atual : '';
}

function preencherProjetos() {
  const sel = $('#f-projeto');
  const atual = sel.value;
  const slugs = [...new Set([...catalogo.map((p) => p.slug), ...registros.map((r) => r.projeto)])];
  slugs.sort((a, b) => nomeProjeto(a).nome.localeCompare(nomeProjeto(b).nome, 'pt-BR'));
  sel.innerHTML = '<option value="">Todos os projetos</option>' + slugs.map((s) => {
    const p = nomeProjeto(s);
    return `<option value="${esc(s)}">${esc(p.nome)}${p.cliente ? ` · ${esc(p.cliente)}` : ''}</option>`;
  }).join('');
  sel.value = slugs.includes(atual) ? atual : '';
}

function filtrados({ ignorarProjeto = false } = {}) {
  const proj = $('#f-projeto').value;
  const dias = Number($('#f-periodo').value);
  const busca = $('#f-busca').value.trim().toLowerCase();
  const desde = dias ? Date.now() - dias * 864e5 : 0;
  return registros.filter((r) => {
    if (!ignorarProjeto && proj && r.projeto !== proj) return false;
    const pc = $('#f-peca').value;
    if (!ignorarProjeto && pc) {
      const [ps, id] = pc.split(':');
      if (r.projeto !== ps || !(r.pecas || []).includes(id)) return false;
    }
    if (desde && r.data && r.data.getTime() < desde) return false;
    if (busca) {
      const alvo = `${r.loja} ${r.nome} ${r.telefone} ${r.projetoNome} ${r.cliente}`.toLowerCase();
      if (!alvo.includes(busca) && !alvo.includes(busca.replace(/\D/g, '') || '§')) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------- desenho
function desenhar() {
  preencherPecas();
  const lista = filtrados();
  const norm = (s) => String(s || '').trim().toLowerCase();
  $('#contagem').textContent = `${lista.length} de ${registros.length}`;

  // tabela
  $('#vazio').hidden = lista.length > 0;
  $('#linhas').innerHTML = lista.slice(0, 1000).map((r) => {
    const p = nomeProjeto(r.projeto);
    const local = r.geo
      ? `<a href="https://www.google.com/maps?q=${r.geo.lat},${r.geo.lng}" target="_blank" rel="noopener">Ver no mapa</a><small>precisão ${r.geo.precisao ?? '?'} m</small>`
      : `<span class="selo alerta">${{ negado: 'Bloqueada', tempo: 'Sem GPS', erro: 'Erro', indisponivel: 'Indisponível' }[r.geoStatus] || 'Sem localização'}</span>`;
    const wa = r.telefone ? `https://wa.me/55${r.telefone}` : '';
    return `<tr>
      <td>${dataFmt(r.data)}</td>
      <td>${esc(p.nome)}<small>${esc(p.cliente)}</small>${nomesPecas(r).length ? `<small class="pecas">${esc(nomesPecas(r).join(' · '))}</small>` : ''}</td>
      <td><b>${esc(r.loja)}</b>${r.bandeira || r.cidade ? `<small>${esc([r.bandeira, r.cidade && `${r.cidade}/${r.uf || ''}`.replace(/\/$/, '')].filter(Boolean).join(' · '))}</small>` : ''}</td>
      <td>${esc(r.nome)}${r.tipoPromotor ? `<small>${r.tipoPromotor === 'proprio' ? 'Próprio' : 'Compartilhado'}</small>` : ''}</td>
      <td>${wa ? `<a href="${wa}" target="_blank" rel="noopener">${esc(telFmt(r.telefone))}</a>` : ''}</td>
      <td>${local}</td>
      <td><span class="selo ${r.origem === 'qr' ? 'ok' : ''}">${r.origem === 'qr' ? 'QR code' : 'Link'}</span></td>
      <td><button class="apagar" type="button" data-apagar="${esc(r.id)}">Apagar</button></td>
    </tr>`;
  }).join('');

  // por projeto (respeita período e busca, não o projeto escolhido)
  const base = filtrados({ ignorarProjeto: true });
  const cont = {};
  base.forEach((r) => { cont[r.projeto] = (cont[r.projeto] || 0) + 1; });
  const slugs = [...new Set([...catalogo.map((p) => p.slug), ...Object.keys(cont), ...Object.keys(senhas), ...Object.keys(paginas)])].sort((a, b) => (cont[b] || 0) - (cont[a] || 0) || nomeProjeto(a).nome.localeCompare(nomeProjeto(b).nome, 'pt-BR'));
  const max = Math.max(1, ...Object.values(cont));
  const sel = $('#f-projeto').value;
  $('#lista-projetos').innerHTML = slugs.map((s) => {
    const p = nomeProjeto(s);
    const n = cont[s] || 0;
    const pag = paginas[s] || {};
    const fora = pag.ativo === false;
    const livre = pag.semSenha === true;
    const bloqueada = !livre && !senhas[s];
    const kit = catalogo.find((c) => c.slug === s)?.pecas || [];
    const off = pag.pecasOff || [];
    const url = `${BASE_PAGINAS}${encodeURIComponent(s)}/`;
    // contagem de registros por peça do enxoval (vai para o pop-up de ajustes)
    const cp = {};
    if (kit.length) base.filter((r) => r.projeto === s).forEach((r) => (r.pecas || []).forEach((id) => { cp[id] = (cp[id] || 0) + 1; }));
    return `<li class="pj ${s === sel ? 'sel' : ''} ${fora ? 'off' : ''}" data-slug="${esc(s)}">
      <div class="pj-top">
        ${htmlMarcador(estiloProjeto(s, catalogo), 30)}
        <span class="pj-id"><b>${esc(p.nome)}</b><small>${esc(p.cliente)}</small></span>
        <span class="pj-q">${n}<i>registro${n === 1 ? '' : 's'}</i></span>
      </div>
      <span class="pbar"><i style="width:${(n / max) * 100}%"></i></span>
      <div class="pj-selos">
        <span class="sl ${fora ? 'ruim' : 'bom'}"><i></i>${fora ? 'Fora do ar' : 'No ar'}</span>
        <span class="sl ${bloqueada ? 'alerta' : ''}">${bloqueada ? 'Sem senha criada' : livre ? 'Abre sem senha' : 'Com senha'}</span>
        ${kit.length ? `<span class="sl">${kit.length - off.length} de ${kit.length} peças</span>` : ''}
        ${(() => { const a = aberturasDe(s); return a.total ? `<span class="sl ${a.total && !cont[s] ? 'alerta' : ''}">${a.total} leitura${a.total > 1 ? 's' : ''} da página${a.qr ? ` · ${a.qr} por QR` : ''}</span>` : ''; })()}
      </div>
      <div class="pj-acoes">
        <a class="bt bt-abrir" href="${url}?equipe=1" target="_blank" rel="noopener" data-abrir="${esc(s)}">${IC.abrir}<span>Abrir página</span></a>
        <a class="bt bt-qr" href="qr.html?p=${encodeURIComponent(s)}" target="_blank" rel="noopener">${IC.qr}<span>Etiqueta QR</span></a>
        <button type="button" class="bt bt-ic" data-cfg="${esc(s)}" title="Ajustes da página" aria-label="Ajustes da página">${IC.ajustes}</button>
        <button type="button" class="bt bt-ic ${s === sel ? 'on' : ''}" data-filtrar="${esc(s)}" title="${s === sel ? 'Tirar o filtro' : 'Ver só este projeto'}" aria-label="Filtrar por este projeto">${IC.filtro}</button>
      </div>
      <dialog class="modal" data-cfg-de="${esc(s)}">
        <div class="modal-in">
          <div class="modal-top">
            <h3>${esc(p.nome)}</h3>
            <button type="button" class="modal-x" data-cfg-fechar aria-label="Fechar">×</button>
          </div>
          <p class="cfg-sub">${esc(p.cliente)} · <a href="${url}" target="_blank" rel="noopener">${esc(url.replace(/^https?:\/\//, ''))}</a></p>
          <div class="cfg-blocos">
            ${linhaStatus(s)}
            ${linhaAcesso(s)}
            ${linhaSenha(s)}
            ${linhaPecas(s)}
            ${kit.length ? `<div class="cfg-cont"><span class="rot">Registros por peça</span><span class="ppecas">${kit.map((pc) => `${esc(pc.nome)} <b>${cp[pc.id] || 0}</b>`).join(' · ')}</span></div>` : ''}
          </div>
          <div class="modal-acoes">
            <a class="bt bt-abrir" href="${url}?equipe=1" target="_blank" rel="noopener" data-abrir="${esc(s)}">${IC.abrir}<span>Abrir página</span></a>
            <a class="bt bt-qr" href="qr.html?p=${encodeURIComponent(s)}" target="_blank" rel="noopener">${IC.qr}<span>Etiqueta QR</span></a>
            <button type="button" class="btn-mini contorno" data-cfg-fechar>Fechar</button>
          </div>
        </div>
      </dialog>
    </li>`;
  }).join('') || '<li class="pc">Nenhum projeto ainda.</li>';
  if (cfgAberto) abrirCfg(cfgAberto, true);

  desenharMapa(lista);
  desenharInteligencia(lista);
}

// ------------------------------------------------- pulso: quem abriu a página
// Um registro só aparece no painel quando a pessoa termina o formulário. O pulso conta a ABERTURA,
// então dá para separar "ninguém escaneou" de "escanearam e desistiram".
function aberturasDe(slug) {
  const lista = acessos.filter((a) => a.projeto === slug && a.etapa === 'abriu' && a.origem !== 'equipe');
  return { total: lista.length, qr: lista.filter((a) => a.origem === 'qr').length, ultima: lista[0]?.data || null };
}

function desenharLeituras() {
  const alvo = $('#intel-leituras');
  if (!alvo) return;
  if (!acessos.length) {
    alvo.innerHTML = '<p class="vazio-td">Nenhuma leitura registrada ainda. A medição começou em 27/10/2026: antes dela não dá para saber quem abriu a página sem registrar.</p>';
    return;
  }
  const slugs = [...new Set(acessos.filter((a) => a.origem !== 'equipe').map((a) => a.projeto))];
  const linhas = slugs.map((slug) => {
    const meus = acessos.filter((a) => a.projeto === slug && a.origem !== 'equipe');
    const etapa = (e) => meus.filter((a) => a.etapa === e).length;
    const sessoes = new Set(meus.map((a) => a.sessao)).size;
    const abriu = etapa('abriu');
    const registrou = etapa('registrou');
    return {
      slug, abriu, sessoes, registrou,
      qr: meus.filter((a) => a.etapa === 'abriu' && a.origem === 'qr').length,
      senha: etapa('senha'),
      senhaOk: etapa('senha-ok'),
      fora: etapa('fora-do-ar'),
      form: etapa('registro'),
      ios: meus.filter((a) => a.etapa === 'abriu' && a.so === 'iOS').length,
      ultima: meus[0]?.data || null,
    };
  }).sort((a, b) => b.abriu - a.abriu);

  alvo.innerHTML = `
    <div class="tabela-wrap"><table class="tabela intel-tabela">
      <thead><tr><th>Página</th><th class="n">Aberturas</th><th class="n">Pelo QR</th><th class="n">Aparelhos</th><th class="n">Parou na senha</th><th class="n">Chegou no formulário</th><th class="n">Registrou</th><th class="n">Conversão</th><th>Última</th></tr></thead>
      <tbody>${linhas.map((l) => `<tr>
        <td><b>${esc(nomeProjeto(l.slug).nome)}</b><small>${esc(nomeProjeto(l.slug).cliente)}</small></td>
        <td class="n">${l.abriu}</td>
        <td class="n">${l.qr}</td>
        <td class="n">${l.sessoes}${l.ios ? `<small>${l.ios} iPhone</small>` : ''}</td>
        <td class="n">${l.senha - l.senhaOk > 0 ? `<b>${l.senha - l.senhaOk}</b>` : '0'}</td>
        <td class="n">${l.form}</td>
        <td class="n">${l.registrou}</td>
        <td class="n">${l.abriu ? Math.round((l.registrou / l.abriu) * 100) + '%' : '-'}</td>
        <td>${l.ultima ? dataFmt(l.ultima) : ''}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    <p class="dica mt-s">Aberturas conta cada vez que a página carregou (fora as prévias da equipe). "Parou na senha" é quem viu a tela da senha e não passou dela. A medição começou em 27/10/2026.</p>`;
}

// ------------------------------------------------- pop-up de ajustes da página
// o card da lista fica limpo (nome, estado e os dois botões grandes); no ar, acesso, senha e peças ficam aqui dentro
let cfgAberto = null;
function abrirCfg(slug) {
  const d = document.querySelector(`[data-cfg-de="${CSS.escape(slug)}"]`);
  if (!d) return;
  cfgAberto = slug;
  if (!d.open) d.showModal();
}
function fecharCfg() {
  cfgAberto = null;
  editando = null;
  document.querySelectorAll('[data-cfg-de][open]').forEach((d) => d.close());
}
$('#lista-projetos').addEventListener('click', (e) => {
  const abre = e.target.closest('[data-cfg]');
  if (abre) return abrirCfg(abre.dataset.cfg);
  if (e.target.closest('[data-cfg-fechar]')) { fecharCfg(); desenhar(); }
});
// o pop-up fecha só no X ou no Fechar (o Esc e o clique fora não fecham sem querer)
$('#lista-projetos').addEventListener('cancel', (e) => e.preventDefault(), true);

// "Abrir página": leva a senha atual e a marca da equipe para este navegador, e a página abre pronta
$('#lista-projetos').addEventListener('click', (e) => {
  const a = e.target.closest('[data-abrir]');
  if (!a) return;
  marcarEquipe(usuarioEmail);
  const hash = senhas[a.dataset.abrir]?.hash;
  if (hash) { try { localStorage.setItem(`acesso75:${a.dataset.abrir}`, hash); } catch {} }
});

// ------------------------------------------------- inteligência de PDV
let recorteAtual = 'bandeira';
let fachadasT;
function desenharInteligencia(lista) {
  try {
    desenharIntel({ lista, todos: registros, qual: recorteAtual, nomeProjeto, dataFmt });
  } catch (e) { console.error('inteligência', e); }
  try { desenharLeituras(); } catch (e) { console.error('leituras', e); }
  clearTimeout(fachadasT);
  fachadasT = setTimeout(() => desenharFachadas({ lista, F, db, dataFmt, nomeProjeto }).catch((e) => console.error('fachadas', e)), 250);
}
// ---------------------------------------------------------------- janelas da inteligência
// a home mostra o essencial; cada quadro denso (funil, horários, cruzamento, promotores, fotos)
// mora numa janela. O bloco não é copiado: ele sai do lugar, entra na janela e volta ao fechar.
(function () {
  const pop = $('#pop');
  const corpo = $('#pop-corpo');
  const blocos = [...document.querySelectorAll('[data-popup]')];
  let dentro = null;
  let marca = null;

  $('#intel-lupas').innerHTML = blocos
    .map((b, i) => (b.dataset.popupFora ? '' : `<button type="button" class="lupa" data-pop="${i}">
      <span><b>${esc(b.dataset.popup)}</b><small>${esc(b.dataset.popupDica || '')}</small></span>${IC.olho}</button>`))
    .join('');

  function abrir(i) {
    if (dentro) fechar();
    const b = blocos[i];
    if (!b) return;
    marca = document.createComment('bloco');
    b.replaceWith(marca);
    corpo.appendChild(b);
    if (b.id === 'intel-fachadas-bloco') b.dataset.aberto = '1'; // na janela as fotos abrem em grade
    $('#pop-tit').textContent = b.dataset.popup;
    dentro = b;
    pop.showModal();
    corpo.parentElement.scrollTop = 0;
  }
  function fechar() {
    if (dentro && marca) {
      if (dentro.id === 'intel-fachadas-bloco') dentro.dataset.aberto = '0';
      marca.replaceWith(dentro);
    }
    dentro = null;
    marca = null;
    pop.close();
  }
  $('#intel-lupas').addEventListener('click', (e) => {
    const b = e.target.closest('[data-pop]');
    if (b) abrir(Number(b.dataset.pop));
  });
  $('#intel-fachadas-abrir').addEventListener('click', () => abrir(blocos.findIndex((b) => b.id === 'intel-fachadas-bloco')));
  $('#pop-x').addEventListener('click', fechar);
  $('#pop-fechar').addEventListener('click', fechar);
  pop.addEventListener('cancel', (e) => e.preventDefault()); // fecha só no X ou no Fechar
})();

$('#intel-abas').addEventListener('click', (e) => {
  const b = e.target.closest('[data-recorte]');
  if (!b) return;
  recorteAtual = b.dataset.recorte;
  $('#intel-abas').querySelectorAll('.aba').forEach((x) => x.classList.toggle('sel', x === b));
  desenharInteligencia(filtrados());
});

function desenharMapa(lista) {
  if (!window.L) return setTimeout(() => desenharMapa(filtrados()), 300);
  if (!mapa) {
    mapa = L.map('mapa', { scrollWheelZoom: false }).setView([-15.8, -47.9], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(mapa);
    camada = L.layerGroup().addTo(mapa);
  }
  camada.clearLayers();
  const comGeo = lista.filter((r) => r.geo);
  const icones = {};
  const icone = (slug) => (icones[slug] ??= L.divIcon({
    className: 'mk-leaflet', html: htmlMarcador(estiloProjeto(slug, catalogo)), iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -30],
  }));
  comGeo.forEach((r) => {
    L.marker([r.geo.lat, r.geo.lng], { icon: icone(r.projeto), title: nomeProjeto(r.projeto).nome }).addTo(camada).bindPopup(
      `<b>${esc(r.loja)}</b><br>${esc(nomeProjeto(r.projeto).nome)}${nomesPecas(r).length ? `<br>Peças: <b>${esc(nomesPecas(r).join(', '))}</b>` : ''}<br>${esc(r.nome)} · ${esc(telFmt(r.telefone))}<br>${dataFmt(r.data)}`,
    );
  });
  $('#mapa-dica').textContent = `${comGeo.length} ponto${comGeo.length === 1 ? '' : 's'} no mapa`;
  // legenda: um marcador por página que aparece no mapa
  const porProjeto = {};
  comGeo.forEach((r) => { porProjeto[r.projeto] = (porProjeto[r.projeto] || 0) + 1; });
  const sel = $('#f-projeto').value;
  $('#legenda').innerHTML = Object.keys(porProjeto)
    .sort((a, b) => nomeProjeto(a).nome.localeCompare(nomeProjeto(b).nome, 'pt-BR'))
    .map((slug) => `<button type="button" class="leg ${slug === sel ? 'sel' : ''}" data-filtrar="${esc(slug)}" title="Filtrar ${esc(nomeProjeto(slug).nome)}">
      ${htmlMarcador(estiloProjeto(slug, catalogo), 24)}<span>${esc(nomeProjeto(slug).nome)}</span><small>${porProjeto[slug]}</small></button>`).join('')
    || '<span class="dica">Os pontos aparecem aqui assim que alguém registrar uma instalação com a localização liberada.</span>';
  if (comGeo.length) mapa.fitBounds(L.latLngBounds(comGeo.map((r) => [r.geo.lat, r.geo.lng])).pad(0.3), { maxZoom: 15 });
}

// ---------------------------------------------------------------- ações
['#f-projeto', '#f-peca', '#f-periodo'].forEach((s) => $(s).addEventListener('change', desenhar));
$('#f-busca').addEventListener('input', desenhar);
const filtrarProjeto = (e) => {
  const a = e.target.closest('[data-filtrar]');
  if (!a) return;
  e.preventDefault();
  $('#f-projeto').value = $('#f-projeto').value === a.dataset.filtrar ? '' : a.dataset.filtrar;
  desenhar();
};
$('#lista-projetos').addEventListener('click', filtrarProjeto);
$('#legenda').addEventListener('click', filtrarProjeto);
$('#linhas').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-apagar]');
  if (!b) return;
  const r = registros.find((x) => x.id === b.dataset.apagar);
  if (!confirm(`Apagar o registro de ${r?.nome || ''} em ${r?.loja || ''}? Não dá para desfazer.`)) return;
  try { await F.deleteDoc(F.doc(db, 'instalacoes', b.dataset.apagar)); toast('Registro apagado.'); }
  catch { toast('Não foi possível apagar.'); }
});

$('#exportar').addEventListener('click', () => {
  const lista = filtrados();
  if (!lista.length) return toast('Nada para exportar neste filtro.');
  const linhas = lista.map((r) => ({
    'Data': r.data ? r.data.toLocaleDateString('pt-BR') : '',
    'Hora': r.data ? r.data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '',
    'Cliente': nomeProjeto(r.projeto).cliente,
    'Projeto': nomeProjeto(r.projeto).nome,
    'Peças': nomesPecas(r).join(', '),
    'Loja': r.loja,
    'Rede': r.bandeira || '',
    'Cidade': r.cidade || '',
    'UF': r.uf || '',
    'Promotor': r.nome,
    'Tipo de promotor': r.tipoPromotor === 'proprio' ? 'Próprio' : r.tipoPromotor === 'compartilhado' ? 'Compartilhado' : '',
    'Telefone': telFmt(r.telefone),
    'Foto da fachada': r.temFoto ? 'Sim' : 'Não',
    'Latitude': r.geo?.lat ?? '',
    'Longitude': r.geo?.lng ?? '',
    'Precisão (m)': r.geo?.precisao ?? '',
    'Localização': r.geo ? `https://www.google.com/maps?q=${r.geo.lat},${r.geo.lng}` : (r.geoStatus || ''),
    'Origem': r.origem === 'qr' ? 'QR code' : 'Link',
  }));
  const nome = `instalacoes-75lab-${new Date().toISOString().slice(0, 10)}`;
  if (window.XLSX) {
    const ws = XLSX.utils.json_to_sheet(linhas);
    ws['!cols'] = Object.keys(linhas[0]).map((k) => ({ wch: Math.max(10, k.length + 2, ...linhas.map((l) => String(l[k]).length).slice(0, 200)) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Instalações');
    XLSX.writeFile(wb, `${nome}.xlsx`);
  } else {
    const cab = Object.keys(linhas[0]);
    const csv = [cab, ...linhas.map((l) => cab.map((k) => l[k]))].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = `${nome}.csv`;
    a.click();
  }
});

// ---------------------------------------------------------------- senhas de acesso das páginas
function linhaSenha(slug) {
  const atual = senhas[slug];
  const livre = paginas[slug]?.semSenha === true;
  if (editando === slug) {
    return `<form class="psenha editar" data-senha-form="${esc(slug)}">
      <input name="senha" value="${esc(rascunho)}" placeholder="Nova senha (mín. 4 caracteres)" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="40">
      <button type="submit" class="btn-mini lime">Salvar</button>
      <button type="button" class="btn-mini" data-senha-cancelar>Cancelar</button>
    </form>`;
  }
  if (!atual) {
    return livre
      ? `<div class="psenha"><span>Nenhuma senha criada <small>só é preciso se voltar a exigir senha</small></span><button type="button" class="btn-mini" data-senha-editar="${esc(slug)}">Criar senha</button></div>`
      : `<div class="psenha sem"><span>Nenhuma senha criada: <b>página bloqueada</b></span><button type="button" class="btn-mini lime" data-senha-editar="${esc(slug)}">Criar senha</button></div>`;
  }
  const ver = visiveis.has(slug);
  const quando = atual.atualizadoEm?.toDate?.().toLocaleDateString('pt-BR') || '';
  return `<div class="psenha">
    <span>Senha <code>${ver ? esc(atual.senha) : '•'.repeat(Math.min(atual.senha.length, 10))}</code></span>
    <button type="button" class="btn-mini" data-senha-ver="${esc(slug)}">${ver ? 'Esconder' : 'Ver'}</button>
    <button type="button" class="btn-mini" data-senha-copiar="${esc(slug)}">Copiar</button>
    <button type="button" class="btn-mini" data-senha-editar="${esc(slug)}">Trocar</button>
    ${quando ? `<small>alterada em ${quando}${atual.atualizadoPor ? ` por ${esc(atual.atualizadoPor.split('@')[0])}` : ''}</small>` : ''}
    ${livre ? '<small>Acesso livre ligado: esta senha fica guardada e volta a valer quando exigir senha.</small>' : ''}
  </div>`;
}

function focarSenha() {
  const input = document.querySelector('[data-senha-form] input');
  if (!input) return;
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}

$('#lista-projetos').addEventListener('click', async (e) => {
  const alvo = e.target.closest('[data-senha-editar],[data-senha-ver],[data-senha-copiar],[data-senha-cancelar]');
  if (!alvo) return;
  if (alvo.dataset.senhaEditar) {
    editando = alvo.dataset.senhaEditar;
    rascunho = '';
    desenhar();
    focarSenha();
  } else if (alvo.dataset.senhaVer) {
    const s = alvo.dataset.senhaVer;
    visiveis.has(s) ? visiveis.delete(s) : visiveis.add(s);
    desenhar();
  } else if (alvo.dataset.senhaCopiar) {
    const senha = senhas[alvo.dataset.senhaCopiar]?.senha || '';
    try { await navigator.clipboard.writeText(senha); toast('Senha copiada.'); } catch { window.prompt('Copie a senha:', senha); }
  } else if ('senhaCancelar' in alvo.dataset) {
    editando = null;
    desenhar();
  }
});
$('#lista-projetos').addEventListener('input', (e) => {
  if (e.target.closest('[data-senha-form]')) rascunho = e.target.value;
});
$('#lista-projetos').addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-senha-form]');
  if (!form) return;
  e.preventDefault();
  const slug = form.dataset.senhaForm;
  const senha = normalizarSenha(form.senha.value);
  if (senha.length < 4) { toast('A senha precisa ter pelo menos 4 caracteres.'); return focarSenha(); }
  const troca = Boolean(senhas[slug]);
  if (troca && !confirm(`Trocar a senha de "${nomeProjeto(slug).nome}"? Quem já entrou com a senha antiga vai precisar digitar a nova.`)) return;
  form.querySelectorAll('button, input').forEach((el) => { el.disabled = true; });
  try {
    await F.setDoc(F.doc(db, 'senhas', slug), {
      senha,
      hash: await hashSenha(slug, senha),
      atualizadoEm: F.serverTimestamp(),
      atualizadoPor: usuarioEmail,
    });
    editando = null;
    visiveis.add(slug);
    toast(troca ? 'Senha trocada. A página já pede a nova senha.' : 'Senha criada. A página já está liberada com ela.');
    desenhar();
  } catch (err) {
    console.error(err);
    toast('Não foi possível salvar a senha.');
    form.querySelectorAll('button, input').forEach((el) => { el.disabled = false; });
  }
});

// ---------------------------------------------------------------- página no ar / fora do ar
function linhaStatus(slug) {
  const p = paginas[slug];
  const off = p?.ativo === false;
  const quando = p?.atualizadoEm?.toDate?.().toLocaleDateString('pt-BR') || '';
  return `<div class="pstatus ${off ? 'off' : ''}">
    <span class="estado"><i></i>${off ? 'Fora do ar' : 'No ar'}</span>
    <button type="button" class="btn-mini ${off ? 'lime' : 'escuro'}" data-status="${esc(slug)}">${off ? 'Colocar no ar' : 'Tirar do ar'}</button>
    ${quando ? `<small>${off ? 'tirada do ar' : 'recolocada no ar'} em ${quando}${p.atualizadoPor ? ` por ${esc(p.atualizadoPor.split('@')[0])}` : ''}</small>` : ''}
  </div>`;
}

$('#lista-projetos').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-status]');
  if (!b) return;
  const slug = b.dataset.status;
  const tirar = paginas[slug]?.ativo !== false;
  const nome = nomeProjeto(slug).nome;
  const msg = tirar
    ? `Tirar "${nome}" do ar?\n\nQuem abrir o link ou escanear o QR vai ver "Página fora do ar" e nenhum registro de instalação será aceito.`
    : `Colocar "${nome}" no ar de novo?\n\nA página volta a abrir com a senha atual.`;
  if (!confirm(msg)) return;
  b.disabled = true;
  try {
    // merge: não apaga o acesso livre (semSenha) gravado pelo outro botão
    await F.setDoc(F.doc(db, 'paginas', slug), { ativo: !tirar, atualizadoEm: F.serverTimestamp(), atualizadoPor: usuarioEmail }, { merge: true });
    toast(tirar ? 'Página fora do ar.' : 'Página no ar de novo.');
  } catch (err) {
    console.error(err);
    toast('Não foi possível mudar o status da página.');
    b.disabled = false;
  }
});

// ---------------------------------------------------------------- enxoval: habilitar / desabilitar peças
function linhaPecas(slug) {
  const kit = catalogo.find((c) => c.slug === slug)?.pecas;
  if (!kit?.length) return '';
  const p = paginas[slug];
  const off = p?.pecasOff || [];
  const quando = p?.pecasOffEm?.toDate?.().toLocaleDateString('pt-BR') || '';
  return `<div class="ppecas-on">
    <span class="rot">Peças na página</span>
    ${kit.map((pc) => {
      const des = off.includes(pc.id);
      return `<button type="button" class="chip-peca ${des ? 'off' : ''}" data-peca="${esc(slug)}" data-peca-id="${esc(pc.id)}" aria-pressed="${!des}" title="${des ? 'Desabilitada: clique para habilitar' : 'Habilitada: clique para desabilitar'}"><i></i>${esc(pc.nome)}</button>`;
    }).join('')}
    ${quando ? `<small>peças alteradas em ${quando}${p.pecasOffPor ? ` por ${esc(p.pecasOffPor.split('@')[0])}` : ''}${off.length ? ` · ${off.length} desabilitada${off.length > 1 ? 's' : ''}` : ''}</small>` : ''}
  </div>`;
}

$('#lista-projetos').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-peca-id]');
  if (!b) return;
  const slug = b.dataset.peca;
  const id = b.dataset.pecaId;
  const kit = catalogo.find((c) => c.slug === slug)?.pecas || [];
  const off = paginas[slug]?.pecasOff || [];
  const desligar = !off.includes(id);
  const nomePeca = kit.find((pc) => pc.id === id)?.nome || id;
  const nome = nomeProjeto(slug).nome;
  if (desligar && kit.filter((pc) => !off.includes(pc.id)).length <= 1) {
    return toast('Pelo menos uma peça precisa ficar habilitada. Para bloquear tudo, use Tirar do ar.');
  }
  const msg = desligar
    ? `Desabilitar "${nomePeca}" em "${nome}"?\n\nA peça some da escolha de peças e da página, e nenhum registro novo com ela é aceito. Os registros antigos continuam no painel.`
    : `Habilitar "${nomePeca}" em "${nome}" de novo?\n\nA peça volta para a escolha de peças e para a página.`;
  if (!confirm(msg)) return;
  b.disabled = true;
  try {
    await F.setDoc(F.doc(db, 'paginas', slug), {
      pecasOff: desligar ? F.arrayUnion(id) : F.arrayRemove(id),
      pecasOffEm: F.serverTimestamp(),
      pecasOffPor: usuarioEmail,
    }, { merge: true });
    toast(desligar ? `${nomePeca} desabilitada.` : `${nomePeca} habilitada de novo.`);
  } catch (err) {
    console.error(err);
    toast('Não foi possível mudar a peça.');
    b.disabled = false;
  }
});

// ---------------------------------------------------------------- acesso livre (sem senha) por página
function linhaAcesso(slug) {
  const p = paginas[slug];
  const livre = p?.semSenha === true;
  const quando = p?.semSenhaEm?.toDate?.().toLocaleDateString('pt-BR') || '';
  return `<div class="pstatus pacesso ${livre ? 'livre' : ''}">
    <span class="estado"><i></i>${livre ? 'Acesso livre, sem senha' : 'Acesso com senha'}</span>
    <button type="button" class="btn-mini ${livre ? 'escuro' : 'contorno'}" data-acesso="${esc(slug)}">${livre ? 'Exigir senha' : 'Liberar sem senha'}</button>
    ${quando ? `<small>${livre ? 'liberada sem senha' : 'senha exigida de novo'} em ${quando}${p.semSenhaPor ? ` por ${esc(p.semSenhaPor.split('@')[0])}` : ''}</small>` : ''}
  </div>`;
}

$('#lista-projetos').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-acesso]');
  if (!b) return;
  const slug = b.dataset.acesso;
  const liberar = paginas[slug]?.semSenha !== true;
  const nome = nomeProjeto(slug).nome;
  const msg = liberar
    ? `Liberar "${nome}" sem senha?\n\nQualquer pessoa com o link ou o QR abre a página e registra a instalação sem digitar senha. A senha atual fica guardada e volta a valer quando você exigir senha de novo.\n\nPara imprimir, use a etiqueta sem o passo da senha (link Etiqueta QR).`
    : `Exigir senha em "${nome}" de novo?\n\n${senhas[slug] ? 'Quem abrir o link ou o QR vai precisar digitar a senha atual.' : 'Esta página não tem senha criada: ela fica bloqueada até alguém criar uma.'}`;
  if (!confirm(msg)) return;
  b.disabled = true;
  try {
    await F.setDoc(F.doc(db, 'paginas', slug), { semSenha: liberar, semSenhaEm: F.serverTimestamp(), semSenhaPor: usuarioEmail }, { merge: true });
    toast(liberar ? 'Página liberada: abre sem senha.' : 'A página voltou a pedir senha.');
  } catch (err) {
    console.error(err);
    toast('Não foi possível mudar o acesso da página.');
    b.disabled = false;
  }
});
