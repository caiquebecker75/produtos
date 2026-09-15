// Acesso à página: (1) a página precisa estar no ar e (2) a pessoa precisa da senha que a equipe define no painel,
// a não ser que o painel tenha liberado a página sem senha.
// - paginas/{slug}.ativo == false → tela "fora do ar" (sem senha, sem conteúdo)
// - paginas/{slug}.semSenha == true → abre direto (as regras também aceitam o registro sem senhaHash)
// - senha conferida pelas regras do Firestore (portas/{slug}/chaves/{hash}); a senha nunca chega ao navegador.
// Depois de acertar, o aparelho guarda o hash e só pede de novo se a senha for trocada no painel.
import { db } from './base.js?v=1';
import { hashSenha } from './senha.js?v=1';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ler = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };

export const chaveAcesso = (slug) => `acesso75:${slug}`;
export const chaveLivre = (slug) => `livre75:${slug}`; // última vez que viu a página com acesso livre (vale sem internet)

// true = senha certa · false = senha errada (ou página fora do ar) · lança erro = sem conexão
async function conferir(slug, hash) {
  const { fs, db: base } = await db();
  try {
    await fs.getDoc(fs.doc(base, 'portas', slug, 'chaves', hash));
    return true;
  } catch (e) {
    if (e.code === 'permission-denied') return false;
    throw e;
  }
}

// { ativo, livre } como está no painel · null = não deu para saber (sem internet)
async function lerPagina(slug) {
  try {
    const { fs, db: base } = await db();
    const snap = await fs.getDoc(fs.doc(base, 'paginas', slug));
    const d = snap.exists() ? snap.data() : {};
    return { ativo: d.ativo !== false, livre: d.semSenha === true };
  } catch {
    return null;
  }
}

function cabecalho(P) {
  return `
    <img class="porta-logo" src="../assets/img/logo-75lab-preto.png" alt="75 LAB" width="57" height="40">
    ${P.logoCliente ? `<img class="porta-cliente" src="${esc(P.logoCliente)}" alt="${esc(P.cliente)}">` : `<div class="porta-eyebrow">${esc(P.cliente)}</div>`}
    <h1>${esc(P.nome)}${P.linha ? ` <b>${esc(P.linha)}</b>` : ''}</h1>`;
}

function telaForaDoAr(tela, P) {
  tela.innerHTML = `
    <div class="porta-card">
      ${cabecalho(P)}
      <div class="fora-do-ar"><span class="fora-dot"></span>Página fora do ar</div>
      <p class="porta-txt">Esta página foi desativada pela 75 LAB e não está recebendo registros de instalação.</p>
      <p class="lgpd">Precisa montar esta peça? Fale com o responsável pela instalação ou com a 75 LAB: <a href="tel:+551150267313">11 5026-7313</a>.</p>
    </div>`;
  document.title = `Fora do ar · ${P.nome}`;
}

// resolve com o hash da senha · null quando a página está com acesso livre (sem senha)
export async function exigirSenha(P) {
  const chave = chaveAcesso(P.slug);
  const tela = document.createElement('div');
  tela.className = 'porta';
  const salvo = ler(chave);

  // uma leitura antes de desenhar qualquer coisa: fora do ar ou acesso livre não podem piscar a tela de senha
  const status = await lerPagina(P.slug);
  if (status && !status.ativo) {
    document.body.appendChild(tela);
    telaForaDoAr(tela, P);
    return new Promise(() => {});
  }
  if (status) gravar(chaveLivre(P.slug), status.livre ? '1' : null);
  if (status ? status.livre : ler(chaveLivre(P.slug))) return salvo || null;

  if (salvo) {
    try {
      if (await conferir(P.slug, salvo)) return salvo;
      gravar(chave, null); // senha trocada no painel
    } catch {
      return salvo; // sem internet na loja: vale a senha que já foi aceita neste aparelho
    }
  }

  return new Promise((resolve) => {
    tela.innerHTML = `
      <form class="porta-card" novalidate>
        ${cabecalho(P)}
        <p class="porta-txt">Digite a <b>senha de acesso</b> para ver a montagem e registrar a instalação.</p>
        <label class="campo"><span>Senha de acesso</span>
          <span class="senha-box">
            <input name="senha" type="password" required autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go">
            <button type="button" class="mostrar" aria-label="Mostrar senha">Mostrar</button>
          </span>
        </label>
        <p class="erro-msg" hidden></p>
        <button class="enviar" type="submit">Entrar</button>
        <p class="lgpd">Não recebeu a senha? Peça ao responsável pela instalação ou fale com a 75 LAB: <a href="tel:+551150267313">11 5026-7313</a>.</p>
      </form>`;
    document.body.appendChild(tela);

    const form = $('form', tela);
    const input = form.senha;
    const erro = $('.erro-msg', tela);
    const botao = $('.enviar', tela);
    const mostrar = $('.mostrar', tela);
    let tentativas = 0;
    setTimeout(() => input.isConnected && input.focus(), 250);

    mostrar.addEventListener('click', () => {
      const ver = input.type === 'password';
      input.type = ver ? 'text' : 'password';
      mostrar.textContent = ver ? 'Esconder' : 'Mostrar';
      input.focus();
    });

    const aviso = (msg) => { erro.textContent = msg; erro.hidden = false; };

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (botao.disabled) return;
      if (!input.value.trim()) { input.setAttribute('aria-invalid', 'true'); return aviso('Digite a senha.'); }
      erro.hidden = true;
      botao.disabled = true;
      botao.textContent = 'Conferindo…';
      try {
        const hash = await hashSenha(P.slug, input.value);
        if (await conferir(P.slug, hash)) {
          gravar(chave, hash);
          tela.remove();
          return resolve(hash);
        }
        const agora = await lerPagina(P.slug);
        if (agora && !agora.ativo) return telaForaDoAr(tela, P);
        if (agora?.livre) { // liberada no painel enquanto a pessoa digitava
          gravar(chaveLivre(P.slug), '1');
          tela.remove();
          return resolve(null);
        }
        tentativas++;
        input.setAttribute('aria-invalid', 'true');
        input.select();
        if (tentativas >= 5) {
          aviso('Muitas tentativas. Aguarde 30 segundos e confira a senha com o responsável.');
          botao.textContent = 'Aguarde';
          setTimeout(() => { tentativas = 0; botao.disabled = false; botao.textContent = 'Entrar'; erro.hidden = true; }, 30000);
          return;
        }
        aviso('Senha incorreta. Confira com o responsável pela instalação.');
      } catch {
        aviso('Sem conexão com a internet. Tente de novo quando o sinal voltar.');
      }
      botao.disabled = false;
      botao.textContent = 'Entrar';
    });
    input.addEventListener('input', () => input.removeAttribute('aria-invalid'));
  });
}
