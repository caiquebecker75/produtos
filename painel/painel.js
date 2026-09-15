// Painel de instalações 75 LAB — lê Firestore/instalacoes em tempo real (só contas @75lab.com.br).
import { firebaseConfig, FIREBASE_SDK } from '../assets/firebase-config.js?v=1';

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
A.onAuthStateChanged(auth, async (user) => {
  pararLeitura?.();
  pararLeitura = null;
  if (!user) return telas('login');
  if (!user.email?.toLowerCase().endsWith(DOMINIO) || !user.emailVerified) {
    await A.signOut(auth);
    $('#login-erro').textContent = `A conta ${user.email} não tem acesso. Entre com o seu e-mail ${DOMINIO}.`;
    $('#login-erro').hidden = false;
    return telas('login');
  }
  $('#usuario').textContent = user.email;
  telas('painel');
  iniciar();
});

// ---------------------------------------------------------------- dados
let registros = [];
let catalogo = [];
let mapa, camada;

async function iniciar() {
  try { catalogo = await (await fetch('../projetos.json', { cache: 'no-store' })).json(); } catch { catalogo = []; }
  const q = F.query(F.collection(db, 'instalacoes'), F.orderBy('criadoEm', 'desc'), F.limit(5000));
  pararLeitura = F.onSnapshot(q, (snap) => {
    registros = snap.docs.map((d) => {
      const r = d.data({ serverTimestamps: 'estimate' });
      return { id: d.id, ...r, data: r.criadoEm?.toDate?.() || null };
    });
    preencherProjetos();
    desenhar();
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
      <td>${esc(p.nome)}<small>${esc(p.cliente)}</small></td>
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
  const slugs = [...new Set([...catalogo.map((p) => p.slug), ...Object.keys(cont)])].sort((a, b) => (cont[b] || 0) - (cont[a] || 0) || nomeProjeto(a).nome.localeCompare(nomeProjeto(b).nome, 'pt-BR'));
  const max = Math.max(1, ...Object.values(cont));
  const sel = $('#f-projeto').value;
  $('#lista-projetos').innerHTML = slugs.map((s) => {
    const p = nomeProjeto(s);
    const n = cont[s] || 0;
    return `<li class="${s === sel ? 'sel' : ''}">
      <span class="pn">${esc(p.nome)}</span><span class="pq">${n}</span>
      <span class="pc">${esc(p.cliente)}</span>
      <span class="pbar"><i style="width:${(n / max) * 100}%"></i></span>
      <span class="plinks"><a href="#" data-filtrar="${esc(s)}">Filtrar</a><a href="${BASE_PAGINAS}${encodeURIComponent(s)}/" target="_blank" rel="noopener">Página</a><a href="${BASE_PAGINAS}${encodeURIComponent(s)}/qr/qr-code.png" target="_blank" rel="noopener">QR code</a></span>
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
  const icone = L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [18, 18] });
  comGeo.forEach((r) => {
    L.marker([r.geo.lat, r.geo.lng], { icon: icone }).addTo(camada).bindPopup(
      `<b>${esc(r.loja)}</b><br>${esc(nomeProjeto(r.projeto).nome)}<br>${esc(r.nome)} · ${esc(telFmt(r.telefone))}<br>${dataFmt(r.data)}`,
    );
  });
  $('#mapa-dica').textContent = `${comGeo.length} ponto${comGeo.length === 1 ? '' : 's'} no mapa`;
  if (comGeo.length) mapa.fitBounds(L.latLngBounds(comGeo.map((r) => [r.geo.lat, r.geo.lng])).pad(0.3), { maxZoom: 15 });
}

// ---------------------------------------------------------------- ações
['#f-projeto', '#f-periodo'].forEach((s) => $(s).addEventListener('change', desenhar));
$('#f-busca').addEventListener('input', desenhar);
$('#lista-projetos').addEventListener('click', (e) => {
  const a = e.target.closest('[data-filtrar]');
  if (!a) return;
  e.preventDefault();
  $('#f-projeto').value = $('#f-projeto').value === a.dataset.filtrar ? '' : a.dataset.filtrar;
  desenhar();
});
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
