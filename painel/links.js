/* =====================================================================
   Links para o cliente.

   A equipe escolhe a campanha no painel e sai um endereço público, sem
   login: quem tem o link acompanha a execução ao vivo. O link pode ser
   editado, bloqueado, reativado, ter validade e ser apagado.

   Duas coleções sustentam isso:
   · compartilhamentos/{token} — o link em si (campanha, opções, estado);
   · publicos/{projeto}        — espelho que ABRE a leitura dos registros
                                 daquele projeto nas regras do Firestore.
   O espelho é recalculado a cada mudança: sem link ativo, o projeto sai
   de publicos e o endereço para de abrir, mesmo que alguém o tenha.
   ===================================================================== */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Number(n || 0).toLocaleString('pt-BR');
const ALFABETO = 'abcdefghijkmnopqrstuvwxyz23456789'; // sem l, 0, 1: o link é lido em voz alta
const token = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => ALFABETO[b % ALFABETO.length]).join('');

let ctx = null;   // { F, db, email, catalogo(), nomeProjeto, dataFmt, toast, aoMudar }
let links = [];
let parar = null;
let editando = null;  // null | { id?, ...dados }

export function iniciarLinks(contexto) {
  ctx = contexto;
  parar?.();
  parar = ctx.F.onSnapshot(ctx.F.collection(ctx.db, 'compartilhamentos'), (snap) => {
    links = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0));
    desenharLista();
  }, (e) => console.error('links', e));

  document.querySelector('#link-novo').addEventListener('click', () => abrirEditor(null));
  document.querySelector('#lista-links').addEventListener('click', aoClicarNaLista);
  document.querySelector('#link-form').addEventListener('submit', salvar);
  document.querySelector('#link-fechar').addEventListener('click', fecharEditor);
  document.querySelector('#link-cancelar').addEventListener('click', fecharEditor);
  // o modal só fecha no X ou no Cancelar: clicar fora e Esc não fecham
  document.querySelector('#link-editor').addEventListener('cancel', (e) => e.preventDefault());
}

export function pararLinks() {
  parar?.();
  parar = null;
  links = [];
}

/* ------------------------------------------------------------------ estado */

const vencido = (l) => !!l.expiraEm && l.expiraEm.toMillis() < Date.now();
const noAr = (l) => l.ativo && !vencido(l);
export const urlDoLink = (id) => new URL(`../cliente/?c=${id}`, location.href).href;

/* ------------------------------------------------------------------- lista */

function desenharLista() {
  const alvo = document.querySelector('#lista-links');
  document.querySelector('#links-dica').textContent = links.length
    ? `${num(links.filter(noAr).length)} no ar de ${num(links.length)}`
    : 'nenhum link criado ainda';
  if (!links.length) {
    alvo.innerHTML = '<li class="link-vazio">Nenhum link ainda. Crie um para o cliente acompanhar a campanha ao vivo, sem login.</li>';
    return;
  }
  alvo.innerHTML = links.map((l) => {
    const estado = !l.ativo ? ['Bloqueado', 'off'] : vencido(l) ? ['Vencido', 'off'] : ['No ar', 'on'];
    const projetos = (l.projetos || []).map((s) => `<span class="chip-proj">${esc(ctx.nomeProjeto(s).nome)}</span>`).join('');
    return `<li class="link-item ${noAr(l) ? '' : 'parado'}" data-id="${esc(l.id)}">
      <div class="link-top">
        <b>${esc(l.titulo)}</b>
        <span class="selo ${estado[1] === 'on' ? 'ok' : 'alerta'}">${estado[0]}</span>
      </div>
      <div class="link-cliente">${esc(l.cliente || '')}</div>
      <div class="link-projs">${projetos}</div>
      <div class="link-url"><code>${esc(urlDoLink(l.id))}</code>
        <button type="button" class="btn-mini lime" data-acao="copiar">Copiar</button>
        <button type="button" class="btn-mini" data-acao="abrir">Abrir</button>
      </div>
      <div class="link-rodape">
        <small>${num(l.visitas || 0)} visita${(l.visitas || 0) === 1 ? '' : 's'}${l.ultimoAcesso ? ` · última ${esc(ctx.dataFmt(l.ultimoAcesso.toDate()))}` : ''}${l.expiraEm ? ` · vence ${esc(ctx.dataFmt(l.expiraEm.toDate()))}` : ''}</small>
        <span class="link-acoes">
          <button type="button" class="btn-mini" data-acao="editar">Editar</button>
          <button type="button" class="btn-mini ${l.ativo ? '' : 'lime'}" data-acao="estado">${l.ativo ? 'Bloquear' : 'Reativar'}</button>
          <button type="button" class="apagar" data-acao="apagar">Apagar</button>
        </span>
      </div>
    </li>`;
  }).join('');
}

async function aoClicarNaLista(e) {
  const b = e.target.closest('[data-acao]');
  if (!b) return;
  const l = links.find((x) => x.id === b.closest('.link-item').dataset.id);
  if (!l) return;
  const url = urlDoLink(l.id);
  if (b.dataset.acao === 'copiar') {
    try { await navigator.clipboard.writeText(url); ctx.toast('Link copiado.'); }
    catch { ctx.toast('Não consegui copiar; o endereço está na tela.'); }
  }
  if (b.dataset.acao === 'abrir') window.open(url, '_blank', 'noopener');
  if (b.dataset.acao === 'editar') abrirEditor(l);
  if (b.dataset.acao === 'estado') await mudarEstado(l, !l.ativo);
  if (b.dataset.acao === 'apagar') await apagar(l);
}

/* ------------------------------------------------------------------ editor */

function abrirEditor(l) {
  editando = l;
  const f = document.querySelector('#link-form');
  const projetos = ctx.catalogo();
  document.querySelector('#link-editor-tit').textContent = l ? 'Editar link' : 'Novo link para o cliente';
  f.titulo.value = l?.titulo || '';
  f.cliente.value = l?.cliente || '';
  f.observacao.value = l?.observacao || '';
  f.validade.value = l?.expiraEm ? 'data' : 'sem';
  f.ate.value = l?.expiraEm ? new Date(l.expiraEm.toMillis() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10) : '';
  f.fotos.checked = l ? !!l.fotos : true;
  f.promotores.checked = l ? !!l.promotores : true;
  document.querySelector('#link-projetos').innerHTML = projetos.map((p) => `
    <label class="esc-proj">
      <input type="checkbox" name="projetos" value="${esc(p.slug)}" ${l?.projetos?.includes(p.slug) ? 'checked' : ''}>
      <span><b>${esc(p.nome)}</b><small>${esc(p.cliente || '')}</small></span>
    </label>`).join('');
  document.querySelector('#link-erro').hidden = true;
  mostrarCampoData();
  document.querySelector('#link-editor').showModal();
  f.titulo.focus();
}

function mostrarCampoData() {
  const f = document.querySelector('#link-form');
  document.querySelector('#link-ate').hidden = f.validade.value !== 'data';
}

function fecharEditor() {
  document.querySelector('#link-editor').close();
  editando = null;
}

async function salvar(e) {
  e.preventDefault();
  const f = e.target;
  const erro = document.querySelector('#link-erro');
  const escolhidos = [...f.querySelectorAll('[name=projetos]:checked')].map((x) => x.value);
  const titulo = f.titulo.value.trim();
  if (titulo.length < 2) return mostrarErro('Dê um nome ao link, por exemplo "Execução Polenguinho · outubro".');
  if (!escolhidos.length) return mostrarErro('Escolha pelo menos uma campanha.');
  if (f.validade.value === 'data' && !f.ate.value) return mostrarErro('Escolha a data de validade ou deixe sem validade.');

  const dias = { '7': 7, '30': 30, '90': 90 }[f.validade.value];
  const expiraEm = f.validade.value === 'data'
    ? new Date(`${f.ate.value}T23:59:59`)
    : dias ? new Date(Date.now() + dias * 864e5) : null;

  const dados = {
    titulo,
    cliente: f.cliente.value.trim(),
    projetos: escolhidos,
    observacao: f.observacao.value.trim(),
    fotos: f.fotos.checked,
    promotores: f.promotores.checked,
    expiraEm,
    ativo: editando ? editando.ativo : true,
    atualizadoEm: ctx.F.serverTimestamp(),
    atualizadoPor: ctx.email,
  };
  const botao = f.querySelector('[type=submit]');
  botao.disabled = true;
  try {
    if (editando) {
      await ctx.F.updateDoc(ctx.F.doc(ctx.db, 'compartilhamentos', editando.id), dados);
    } else {
      await ctx.F.setDoc(ctx.F.doc(ctx.db, 'compartilhamentos', token()), {
        ...dados, visitas: 0, criadoEm: ctx.F.serverTimestamp(), criadoPor: ctx.email,
      });
    }
    await sincronizarPublicos();
    erro.hidden = true;
    fecharEditor();
    ctx.toast(editando ? 'Link atualizado.' : 'Link criado. Copie e mande para o cliente.');
  } catch (ex) {
    console.error(ex);
    mostrarErro(ex.code === 'permission-denied' ? 'Sem permissão para salvar.' : `Não consegui salvar (${ex.code || ex.message}).`);
  } finally {
    botao.disabled = false;
  }
}

function mostrarErro(msg) {
  const erro = document.querySelector('#link-erro');
  erro.textContent = msg;
  erro.hidden = false;
}

async function mudarEstado(l, ativo) {
  try {
    await ctx.F.updateDoc(ctx.F.doc(ctx.db, 'compartilhamentos', l.id), {
      ativo, atualizadoEm: ctx.F.serverTimestamp(), atualizadoPor: ctx.email,
    });
    await sincronizarPublicos();
    ctx.toast(ativo ? 'Link reativado.' : 'Link bloqueado: quem abrir vê que o acesso foi encerrado.');
  } catch (e) {
    console.error(e);
    ctx.toast('Não consegui mudar o estado do link.');
  }
}

async function apagar(l) {
  if (!confirm(`Apagar o link "${l.titulo}"? Quem tiver o endereço deixa de ver a campanha.`)) return;
  try {
    await ctx.F.deleteDoc(ctx.F.doc(ctx.db, 'compartilhamentos', l.id));
    await sincronizarPublicos(l.id);
    ctx.toast('Link apagado.');
  } catch (e) {
    console.error(e);
    ctx.toast('Não consegui apagar o link.');
  }
}

/* ----------------------------------------------- espelho que abre a leitura */

/** Recalcula publicos/{projeto} a partir dos links no ar. `ignorar` tira um link que acabou de sair. */
async function sincronizarPublicos(ignorar) {
  const vivos = links.filter((l) => l.id !== ignorar && noAr(l));
  const querem = new Map(); // slug → { fotos, ate }
  for (const l of vivos) {
    for (const slug of (l.projetos || [])) {
      const atual = querem.get(slug) || { fotos: false, ate: null, semPrazo: false };
      atual.fotos = atual.fotos || !!l.fotos;
      if (!l.expiraEm) atual.semPrazo = true;
      else atual.ate = Math.max(atual.ate || 0, l.expiraEm.toMillis());
      querem.set(slug, atual);
    }
  }
  const atuais = await ctx.F.getDocs(ctx.F.collection(ctx.db, 'publicos'));
  const tarefas = [];
  for (const d of atuais.docs) {
    if (!querem.has(d.id)) tarefas.push(ctx.F.deleteDoc(d.ref));
  }
  for (const [slug, v] of querem) {
    tarefas.push(ctx.F.setDoc(ctx.F.doc(ctx.db, 'publicos', slug), {
      fotos: v.fotos,
      ate: v.semPrazo || !v.ate ? null : new Date(v.ate),
      atualizadoEm: ctx.F.serverTimestamp(),
      atualizadoPor: ctx.email,
    }));
  }
  await Promise.all(tarefas);
}

document.addEventListener('change', (e) => {
  if (e.target.name === 'validade') mostrarCampoData();
});
