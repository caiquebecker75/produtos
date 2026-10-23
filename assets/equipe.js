// Prévia da equipe: quando alguém do painel clica em "Abrir página", a página abre pronta,
// sem senha, sem escolher peças e sem o registro obrigatório.
// Como funciona: o painel (mesma origem, já autenticado com conta @75lab.com.br) grava um sinal
// no localStorage deste navegador e abre a página com ?equipe=1. Sem o sinal, o ?equipe=1 não vale nada.
const CHAVE = 'equipe75';
const VALE = 12 * 3600e3; // 12 h depois do último acesso ao painel

export function marcarEquipe(email) {
  try { localStorage.setItem(CHAVE, JSON.stringify({ email: email || '', em: Date.now() })); } catch {}
}

// { email } quando é a equipe vendo a prévia · null para o resto do mundo
export function modoEquipe() {
  try {
    if (!new URLSearchParams(location.search).has('equipe')) return null;
    const d = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    if (!d?.em || Date.now() - d.em > VALE) return null;
    return { email: d.email || '' };
  } catch { return null; }
}

// tarja fixa no alto da página, para ninguém confundir prévia com a página do promotor
export function tarjaEquipe({ email }, { pecas = 0, total = 0 } = {}) {
  const u = new URL(location.href);
  u.searchParams.delete('equipe');
  const quem = email ? email.split('@')[0] : 'equipe';
  const tarja = document.createElement('div');
  tarja.className = 'tarja-equipe';
  tarja.innerHTML = `
    <span class="te-selo">Prévia da equipe</span>
    <span class="te-txt">Você está vendo a página como a 75 LAB${pecas ? `, com ${pecas} de ${total} peça${total > 1 ? 's' : ''}` : ''}. Nada é registrado e a senha não é pedida.</span>
    <a class="te-btn" href="${u.pathname}${u.search}">Ver como o promotor vê</a>
    <span class="te-quem">${quem}</span>`;
  document.body.appendChild(tarja);
  document.documentElement.classList.add('com-tarja');
}
