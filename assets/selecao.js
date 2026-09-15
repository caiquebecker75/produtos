// Enxoval (várias peças): antes dos dados da instalação, a pessoa marca quais peças vai executar agora.
// A página mostra só essas e o registro guarda a lista — as outras peças podem ir para outras lojas.
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const X_ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

// resolve com a lista de ids escolhidos · com cancelavel, resolve null se fechar no X
export function escolherPecas(P, { inicial = [], cancelavel = false } = {}) {
  return new Promise((resolve) => {
    const marcadas = new Set(inicial);
    const tela = document.createElement('div');
    tela.className = 'porta selecao';
    tela.innerHTML = `
      <form class="porta-card sel-card" novalidate>
        <div class="sel-top">
          <img class="porta-logo" src="../assets/img/logo-75lab-preto.png" alt="75 LAB" width="57" height="40">
          ${cancelavel ? `<button type="button" class="fechar" aria-label="Fechar">${X_}</button>` : ''}
        </div>
        ${P.logoCliente ? `<img class="porta-cliente" src="${esc(P.logoCliente)}" alt="${esc(P.cliente)}">` : `<div class="porta-eyebrow">${esc(P.cliente)}</div>`}
        <h1>Quais peças você vai <b>executar agora?</b></h1>
        <p class="porta-txt">Marque só o que vai instalar <b>nesta loja</b>. As outras peças podem ir para outras lojas.</p>
        <div class="sel-lista">
          ${P.kit.map((x) => `
          <label class="sel-item">
            <input type="checkbox" value="${esc(x.id)}"${marcadas.has(x.id) ? ' checked' : ''}>
            <span class="sel-img">${x.miniatura || x.imagem ? `<img src="${esc(x.miniatura || x.imagem)}" alt="" decoding="async">` : ''}</span>
            <span class="sel-txt"><b>${esc(x.nome)}</b>${x.resumo ? `<small>${esc(x.resumo)}</small>` : ''}</span>
            <span class="sel-check">${CHECK}</span>
          </label>`).join('')}
        </div>
        <button type="button" class="link-btn sel-todas">Selecionar todas</button>
        <button class="enviar" type="submit" disabled>Escolha as peças</button>
      </form>`;
    document.body.appendChild(tela);
    document.body.style.overflow = 'hidden';

    const botao = $('.enviar', tela);
    const todas = $('.sel-todas', tela);
    const caixas = [...tela.querySelectorAll('input[type=checkbox]')];
    const atualizar = () => {
      const n = caixas.filter((c) => c.checked).length;
      botao.disabled = !n;
      botao.textContent = n ? `Continuar com ${n} peça${n > 1 ? 's' : ''}` : 'Escolha as peças';
      todas.textContent = n === caixas.length ? 'Desmarcar todas' : 'Selecionar todas';
    };
    caixas.forEach((c) => c.addEventListener('change', atualizar));
    todas.addEventListener('click', () => {
      const marcar = !caixas.every((c) => c.checked);
      caixas.forEach((c) => { c.checked = marcar; });
      atualizar();
    });
    const fim = (valor) => { tela.remove(); document.body.style.overflow = ''; resolve(valor); };
    $('.fechar', tela)?.addEventListener('click', () => fim(null));   // só fecha no X
    $('form', tela).addEventListener('submit', (e) => {
      e.preventDefault();
      const sel = caixas.filter((c) => c.checked).map((c) => c.value);
      if (sel.length) fim(sel);
    });
    atualizar();
  });
}
