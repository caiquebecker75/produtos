// Painel de instalações 75 LAB — lê Firestore/instalacoes em tempo real (só contas @75lab.com.br).
import { firebaseConfig, FIREBASE_SDK } from '../assets/firebase-config.js?v=1';
import { hashSenha, normalizarSenha } from '../assets/senha.js?v=1';
import { estiloProjeto, htmlMarcador } from './marcadores.js?v=1';

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
let usuarioEmail = '';
A.onAuthStateChanged(auth, async (user) => {
  pararLeitura?.();
  pararSenhas?.();
  pararPaginas?.();
  pararLeitura = pararSenhas = pararPaginas = null;
  if (!user) return telas('login');
  if (!user.email?.toLowerCase().endsWith(DOMINIO) || !user.emailVerified) {
    await A.signOut(auth);
    $('#login-erro').textContent = `A conta ${user.email} não tem acesso. Entre com o seu e-mail ${DOMINIO}.`;
    $('#login-erro').hidden = false;
    return telas('login');
  }
  $('#usuario').textContent = user.email;
  usuarioEmail = user.email;
  telas('painel');
  iniciar();
});

// ---------------------------------------------------------------- dados
let registros = [];
let catalogo = [];
let mapa, camada;
let paginas = {};         // slug → { ativo, atualizadoEm, atualizadoPor, semSenha, semSenhaEm, semSenhaPor }
let senhas = {};          // slug → { senha, atualizadoEm, atualizadoPor }
let editando = null;      // slug com o campo de senha aberto
let rascunho = '';
const visiveis = new Set();

async function iniciar() {
  try { catalogo = await (await fetch('../projetos.json', { cache: 'no-store' })).json(); } catch { catalogo = []; }
  pararPaginas = F.onSnapshot(F.collection(db, 'paginas'), (snap) => {
    paginas = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
    if (!editando) desenhar();
  }, (e) => console.error(e));
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
  $('#k-total').textContent = lista.length.toLocaleString('pt-BR');
  $('#k-lojas').textContent = new Set(lista.map((r) => norm(r.loja))).size.toLocaleString('pt-BR');
  $('#k-pessoas').textContent = new Set(lista.map((r) => r.telefone)).size.toLocaleString('pt-BR');
  $('#k-geo').textContent = lista.length ? `${Math.round((lista.filter((r) => r.geo).length / lista.length) * 100)}%` : '0%';
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
      <td><b>${esc(r.loja)}</b></td>
      <td>${esc(r.nome)}</td>
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
    return `<li class="${s === sel ? 'sel' : ''} ${paginas[s]?.ativo === false ? 'off' : ''}">
      <span class="pn">${htmlMarcador(estiloProjeto(s, catalogo), 22)}${esc(p.nome)}</span><span class="pq">${n}</span>
      <span class="pc">${esc(p.cliente)}</span>
      <span class="pbar"><i style="width:${(n / max) * 100}%"></i></span>
      ${(() => {
        const kit = catalogo.find((c) => c.slug === s)?.pecas;
        if (!kit?.length) return '';
        const cp = {};
        base.filter((r) => r.projeto === s).forEach((r) => (r.pecas || []).forEach((id) => { cp[id] = (cp[id] || 0) + 1; }));
        return `<span class="ppecas">${kit.map((pc) => `${esc(pc.nome)} <b>${cp[pc.id] || 0}</b>`).join(' · ')}</span>`;
      })()}
      <span class="plinks"><a href="#" data-filtrar="${esc(s)}">Filtrar</a><a href="${BASE_PAGINAS}${encodeURIComponent(s)}/" target="_blank" rel="noopener">Página</a><a href="qr.html?p=${encodeURIComponent(s)}" target="_blank" rel="noopener">Etiqueta QR</a></span>
      ${linhaStatus(s)}
      ${linhaAcesso(s)}
      ${linhaSenha(s)}
    </li>`;
  }).join('') || '<li class="pc">Nenhum projeto ainda.</li>';

  desenharMapa(lista);
}

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
    'Promotor': r.nome,
    'Telefone': telFmt(r.telefone),
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
