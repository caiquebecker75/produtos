// Visor de foto do painel e da página do cliente.
// Antes a foto abria numa aba nova com data: URL — o Chrome bloqueia esse tipo de navegação e
// a aba ficava em branco. Agora a foto amplia aqui mesmo, com legenda, setas e botão de baixar.
let tela = null;
let itens = [];
let atual = 0;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CSS = `
.visor { position: fixed; inset: 0; z-index: 3000; background: rgba(14,17,16,.92); display: grid; grid-template-rows: auto 1fr auto; gap: 10px; padding: 14px; }
.visor-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #fff; }
.visor-top b { font-size: 15px; font-weight: 500; }
.visor-top small { display: block; color: #B5BAAE; font-size: 12.5px; }
.visor-fechar { background: rgba(255,255,255,.12); color: #fff; border: 0; border-radius: 50%; width: 38px; height: 38px; font-size: 22px; line-height: 1; flex: none; cursor: pointer; }
.visor-fechar:hover { background: rgba(255,255,255,.22); }
.visor-palco { position: relative; display: grid; place-items: center; min-height: 0; }
.visor-palco img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 14px; display: block; }
.visor-nav { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,.14); color: #fff; border: 0; width: 46px; height: 46px; border-radius: 50%; font-size: 26px; line-height: 1; cursor: pointer; }
.visor-nav:hover { background: rgba(255,255,255,.26); }
.visor-nav.ant { left: 6px; } .visor-nav.prox { right: 6px; }
.visor-pe { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; color: #B5BAAE; font-size: 12.5px; }
.visor-pe a, .visor-pe span.conta { background: rgba(255,255,255,.12); color: #fff; text-decoration: none; border-radius: 20px; padding: 8px 14px; font-size: 13px; }
.visor-pe a:hover { background: rgba(255,255,255,.24); }
`;

function estilo() {
  if (document.getElementById('visor-css')) return;
  const s = document.createElement('style');
  s.id = 'visor-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}

function fechar() {
  tela?.remove();
  tela = null;
  document.body.style.overflow = '';
}

function desenhar() {
  const it = itens[atual];
  if (!it) return fechar();
  tela.innerHTML = `
    <div class="visor-top">
      <span><b>${esc(it.titulo)}</b><small>${esc(it.subtitulo || '')}</small></span>
      <button type="button" class="visor-fechar" aria-label="Fechar">×</button>
    </div>
    <div class="visor-palco">
      ${itens.length > 1 ? '<button type="button" class="visor-nav ant" aria-label="Anterior">‹</button>' : ''}
      <img src="${it.src}" alt="${esc(it.titulo)}">
      ${itens.length > 1 ? '<button type="button" class="visor-nav prox" aria-label="Próxima">›</button>' : ''}
    </div>
    <div class="visor-pe">
      ${itens.length > 1 ? `<span class="conta">${atual + 1} de ${itens.length}</span>` : ''}
      <a href="${it.src}" download="${esc(it.arquivo || 'foto.jpg')}">Baixar foto</a>
      ${it.mapa ? `<a href="${esc(it.mapa)}" target="_blank" rel="noopener">Ver no mapa</a>` : ''}
      ${it.rodape ? `<span>${esc(it.rodape)}</span>` : ''}
    </div>`;
  tela.querySelector('.visor-fechar').onclick = fechar;
  tela.querySelector('.ant')?.addEventListener('click', () => ir(-1));
  tela.querySelector('.prox')?.addEventListener('click', () => ir(1));
}

function ir(d) {
  atual = (atual + d + itens.length) % itens.length;
  desenhar();
}

// lista = [{ src, titulo, subtitulo, arquivo, mapa, rodape }]
export function abrirVisor(lista, indice = 0) {
  if (!lista?.length) return;
  estilo();
  itens = lista;
  atual = Math.max(0, Math.min(indice, lista.length - 1));
  if (!tela) {
    tela = document.createElement('div');
    tela.className = 'visor';
    tela.setAttribute('role', 'dialog');
    tela.setAttribute('aria-modal', 'true');
    document.body.appendChild(tela);
    document.body.style.overflow = 'hidden';
    let x0 = null;
    tela.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    tela.addEventListener('touchend', (e) => {
      if (x0 == null || itens.length < 2) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) ir(dx < 0 ? 1 : -1);
      x0 = null;
    });
  }
  desenhar();
}

document.addEventListener('keydown', (e) => {
  if (!tela) return;
  if (e.key === 'Escape') fechar();
  if (e.key === 'ArrowRight') ir(1);
  if (e.key === 'ArrowLeft') ir(-1);
});
