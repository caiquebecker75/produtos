// Senha de acesso: a página só abre depois da senha que a equipe 75 LAB define no painel.
// Quem confere são as regras do Firestore (portas/{slug}/chaves/{hash}); a senha nunca chega ao navegador.
// Depois de acertar, o aparelho guarda o hash e só pede de novo se a senha for trocada no painel.
import { db } from './base.js?v=1';
import { hashSenha } from './senha.js?v=1';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ler = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const gravar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };

export const chaveAcesso = (slug) => `acesso75:${slug}`;

// true = senha certa · false = senha errada · lança erro = sem conexão
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

export async function exigirSenha(P) {
  const chave = chaveAcesso(P.slug);
  const salvo = ler(chave);
  if (salvo) {
    try {
      if (await conferir(P.slug, salvo)) return salvo;
      gravar(chave, null); // senha trocada no painel
    } catch {
      return salvo; // sem internet na loja: vale a senha que já foi aceita neste aparelho
    }
  }

  return new Promise((resolve) => {
    const tela = document.createElement('div');
    tela.className = 'porta';
    tela.innerHTML = `
      <form class="porta-card" novalidate>
        <img class="porta-logo" src="../assets/img/logo-75lab-preto.png" alt="75 LAB" width="57" height="40">
        ${P.logoCliente ? `<img class="porta-cliente" src="${esc(P.logoCliente)}" alt="${esc(P.cliente)}">` : `<div class="porta-eyebrow">${esc(P.cliente)}</div>`}
        <h1>${esc(P.nome)}${P.linha ? ` <b>${esc(P.linha)}</b>` : ''}</h1>
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
    setTimeout(() => input.focus(), 250);

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
