// Página de produto 75 LAB — monta a página a partir do JSON <script type="application/json" id="projeto">.
// Blocos sem dados (vídeo, AR, checklist...) simplesmente não aparecem.
// Texto aceita **negrito**. Ver _modelo/index.html para todos os campos.
import { iniciarRegistro } from './registro.js?v=3';
import { exigirSenha } from './acesso.js?v=2';

const $ = (s, el = document) => el.querySelector(s);
const P = JSON.parse($('#projeto').textContent);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const dois = (n) => String(n).padStart(2, '0');
const isMobile = document.documentElement.classList.contains('is-mobile');
const ua = navigator.userAgent;
const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const pageUrl = location.origin + location.pathname;

const ICON = {
  reg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  mais: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  ar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M12 6.6l4.6 2.7v5.4L12 17.4l-4.6-2.7V9.3z"/><path d="M7.4 9.3 12 12l4.6-2.7M12 12v5.4"/></svg>',
  girar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></svg>',
};

// ---------------------------------------------------------------- blocos
const blocos = [];

function capa() {
  const dims = (P.medidas?.principais || []).map((d) => `<span>${esc(d.rotulo)}<b>${esc(d.valor)}${d.unidade ? ' ' + esc(d.unidade) : ''}</b></span>`).join('');
  return `
  <section class="hero" id="topo">
    <div class="hero-card">
      <div class="hero-txt">
        ${P.logoCliente ? `<img class="cliente-logo" src="${esc(P.logoCliente)}" alt="${esc(P.cliente)}">` : `<div class="cliente-nome">${esc(P.cliente)}</div>`}
        <h1>${esc(P.nome)}${P.linha ? ` <b>${esc(P.linha)}</b>` : ''}</h1>
        <p class="sub">${esc(P.subtitulo || 'Treinamento de montagem')}</p>
        ${P.tipo ? `<p class="tipo">${esc(P.tipo)}</p>` : ''}
        ${dims ? `<div class="dims">${dims}</div>` : ''}
      </div>
      <div class="hero-img">${P.imagem ? `<img src="${esc(P.imagem)}" alt="${esc(P.nome)} ${esc(P.linha || '')}">` : ''}</div>
    </div>
  </section>`;
}

function objetivo() {
  const o = P.objetivo;
  if (!o) return '';
  blocos.push(['objetivo', 'Objetivo']);
  const pontos = (o.pontos || []).map((p, i) => `<li><span class="n">${dois(i + 1)}</span><strong>${esc(p.titulo)}</strong><span>${md(p.texto)}</span></li>`).join('');
  return `
  <section class="sec" id="objetivo">
    <div class="wrap obj">
      <div class="obj-txt">
        <div class="eyebrow">Objetivo da peça</div>
        <h2 class="h2">Para que <b>serve</b></h2>
        <p>${md(o.texto)}</p>
      </div>
      ${pontos ? `<ol class="pontos">${pontos}</ol>` : ''}
    </div>
  </section>`;
}

function montagem() {
  const passos = P.montagem || [];
  if (!passos.length) return '';
  blocos.push(['montagem', 'Montagem']);
  const pecas = (P.pecas || []).map((p) => `<li><b>${esc(p.qtd)}×</b>${md(p.nome)}</li>`).join('');
  return `
  <section class="sec dark" id="montagem">
    <div class="wrap">
      <div class="eyebrow">Instruções de montagem</div>
      <h2 class="h2">Montagem <b>do material</b></h2>
      ${P.tempoMontagem ? `<p class="lead">Tempo médio: <b>${esc(P.tempoMontagem)}</b>. Siga os passos na ordem.</p>` : '<p class="lead">Siga os passos na ordem, sem pular etapas.</p>'}
      <div class="mont">
        <div style="display:grid;gap:12px">
          ${pecas ? `<div class="caixa"><h3>O que vem na caixa</h3><ul>${pecas}</ul>${P.ferramentas ? `<p class="obs">${md(P.ferramentas)}</p>` : ''}</div>` : ''}
          <ol class="passos">
            ${passos.map((p, i) => `
            <li class="passo">
              <div class="num"><small>Passo</small><i>${i + 1}</i></div>
              <div><h3>${esc(p.titulo)}</h3><p>${md(p.texto)}</p>${p.alerta ? `<p class="alerta">${md(p.alerta)}</p>` : ''}</div>
            </li>`).join('')}
          </ol>
        </div>
        <div class="mont-img">${P.imagemMontado || P.imagem ? `<img src="${esc(P.imagemMontado || P.imagem)}" alt="" loading="lazy">` : ''}</div>
      </div>
    </div>
  </section>`;
}

function video() {
  const v = P.video;
  if (!v || !(v.mp4 || v.youtube || v.pendente)) return '';
  blocos.push(['video', 'Vídeo']);
  const vert = v.orientacao === 'vertical';
  const player = v.pendente
    ? `<div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px;color:#9AA08F;font-size:14px;background:#1B201D">${v.poster ? `<img src="${esc(v.poster)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.35">` : ''}<span style="position:relative">${md(v.pendente)}</span></div>`
    : v.youtube
    ? `<iframe src="https://www.youtube-nocookie.com/embed/${esc(v.youtube)}?rel=0&playsinline=1" title="Vídeo de montagem" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>`
    : `<video controls playsinline preload="metadata" ${v.poster ? `poster="${esc(v.poster)}"` : ''}><source src="${esc(v.mp4)}" type="video/mp4"></video>`;
  return `
  <section class="sec dark video" id="video" style="padding-top:0">
    <div class="wrap">
      <div class="video-box ${vert ? 'vert' : ''}">
        <div class="player ${vert ? 'v' : 'h'}">${player}</div>
        <div class="video-info">
          <div class="eyebrow">Vídeo de montagem</div>
          <h2 class="h2">Veja <b>passo a passo</b></h2>
          <p class="lead">${md(v.texto || 'Assista antes de abrir a embalagem: a montagem fica mais rápida e sem retrabalho.')}</p>
          ${v.duracao ? `<p class="dur">Duração ${esc(v.duracao)}</p>` : ''}
        </div>
      </div>
    </div>
  </section>`;
}

function ar() {
  const a = P.ar;
  if (!a || !a.glb) return '';
  blocos.push(['ar', 'Ver no local']);
  return `
  <section class="sec ar" id="ar">
    <div class="wrap">
      <div class="eyebrow">Realidade aumentada</div>
      <h2 class="h2">Veja no <b>seu espaço</b></h2>
      <p class="lead">Antes de montar, coloque a peça em <b>tamanho real</b> no chão da loja pela câmera do celular e confira se o local escolhido funciona: passagem, altura, gôndola e visibilidade.</p>
      <div class="ar-grid">
        <div class="stage">
          <model-viewer alt="${esc(P.nome)} em 3D" src="${esc(a.glb)}" ${a.usdz ? `ios-src="${esc(a.usdz)}"` : ''} ${a.poster ? `poster="${esc(a.poster)}"` : ''}
            ar ar-modes="webxr scene-viewer quick-look" ar-scale="fixed" ar-placement="floor" xr-environment
            camera-controls auto-rotate auto-rotate-delay="2500" rotation-per-second="14deg"
            camera-orbit="28deg 78deg auto" min-camera-orbit="auto 25deg auto" max-camera-orbit="auto 92deg auto"
            interaction-prompt="none" shadow-intensity="1.1" shadow-softness="0.9" environment-image="neutral" exposure="1.05" loading="lazy">
            <button slot="ar-button" hidden></button>
            <div slot="progress-bar"></div>
            <div slot="ar-prompt" class="ar-prompt">Aponte para o <b>chão</b> e mova o celular devagar</div>
          </model-viewer>
          <div class="drag">${ICON.girar}Arraste para girar</div>
          <div class="progress"><i></i></div>
        </div>
        <div>
          <div id="ar-mobile">
            <button class="cta" id="cta-ar" type="button" disabled>${ICON.ar}<span>Carregando 3D</span></button>
            <ul class="ar-dicas">
              <li><span>1</span>Vá até o ponto onde a peça vai ficar e aponte a câmera para o chão.</li>
              <li><span>2</span>Mova o celular devagar até a peça aparecer, em tamanho real.</li>
              <li><span>3</span>Ande ao redor: confira corredor, altura e se nada tampa a visão do shopper.</li>
            </ul>
          </div>
          <div id="ar-noar" hidden>
            <div class="note"><strong>Abra no navegador</strong>Para ver em realidade aumentada, abra este link no <b>Safari</b> (iPhone) ou no <b>Chrome</b> (Android).</div>
            <button class="ghost" id="copiar" type="button">Copiar link</button>
          </div>
          <div id="ar-desktop" hidden>
            <div class="qrcard"><div class="qr" id="qr-ar"></div><div><strong>Abra no celular</strong><p>Aponte a câmera do celular para o código e toque em <b>Ver no meu espaço</b>.</p></div></div>
            <ul class="ar-dicas">
              <li><span>1</span>Leve o celular até o ponto da loja onde a peça vai ficar.</li>
              <li><span>2</span>Aponte para o chão e mova o aparelho devagar.</li>
              <li><span>3</span>A peça aparece em tamanho real: ande ao redor e confira o espaço.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function medidas() {
  const m = P.medidas;
  if (!m) return '';
  blocos.push(['medidas', 'Medidas']);
  const big = (m.principais || []).map((d) => `<div><small>${esc(d.rotulo)}</small><b>${esc(d.valor)}</b><em>${esc(d.unidade || '')}</em></div>`).join('');
  const grupos = (m.grupos || []).map((g) => `
    <section>
      <h3>${esc(g.titulo)}</h3>
      ${g.texto ? `<p>${md(g.texto)}</p>` : ''}
      ${g.itens?.length ? `<dl>${g.itens.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${md(v)}</dd></div>`).join('')}</dl>` : ''}
    </section>`).join('');
  return `
  <section class="sec medidas" id="medidas">
    <div class="wrap">
      <div class="eyebrow">Dimensional</div>
      <h2 class="h2">Medidas <b>e ficha técnica</b></h2>
      <div class="med-grid">
        ${m.desenho ? `<figure class="desenho"><img src="${esc(m.desenho)}" alt="Desenho técnico com as medidas" loading="lazy">${m.legenda ? `<figcaption>${esc(m.legenda)}</figcaption>` : ''}</figure>` : ''}
        <div>
          ${big ? `<div class="big-dims">${big}</div>` : ''}
          <div class="ficha">${grupos}</div>
        </div>
      </div>
    </div>
  </section>`;
}

function checklist() {
  const grupos = P.checklist || [];
  if (!grupos.length) return '';
  blocos.push(['checklist', 'Checklist']);
  let n = 0;
  const html = grupos.map((g) => `
    <div class="grupo-check">
      <h3>${esc(g.grupo)}</h3>
      ${g.itens.map((t) => `<label class="item"><input type="checkbox" data-i="${n++}"><span class="box">${ICON.check}</span><span>${md(t)}</span></label>`).join('')}
    </div>`).join('');
  return `
  <section class="sec check" id="checklist">
    <div class="wrap">
      <div class="eyebrow">Checklist de execução</div>
      <h2 class="h2">Antes de <b>ir embora</b></h2>
      <p class="lead">Marque cada item conforme conclui. Fica salvo neste celular.</p>
      <div class="check-card">
        <div class="check-head">
          <div class="contagem"><span id="ck-feitos">0</span>/${n}<small>itens</small></div>
          <div class="barra"><i id="ck-barra"></i></div>
          <button type="button" class="link-btn" id="ck-limpar">Limpar</button>
        </div>
        ${html}
        <div class="check-fim" id="ck-fim" hidden>${ICON.check}<div><b>Execução completa</b><div style="font-size:14px;color:#C9CDC3">Tudo conferido. Se ainda não registrou a instalação, toque em <b style="font-family:inherit;text-transform:none;letter-spacing:0;font-size:inherit;font-weight:500">Registrar instalação</b> no topo.</div></div></div>
      </div>
    </div>
  </section>`;
}

function faq() {
  const f = P.faq || [];
  if (!f.length) return '';
  blocos.push(['faq', 'FAQ']);
  return `
  <section class="sec dark" id="faq">
    <div class="wrap faq-grid">
      <div>
        <div class="eyebrow">Dúvidas frequentes</div>
        <h2 class="h2">FAQ <b>de execução</b></h2>
        <p class="lead">Não achou a resposta? Fale com a 75 LAB pelo telefone do rodapé.</p>
      </div>
      <div class="faq-list">
        ${f.map((q, i) => `<details${i === 0 ? ' open' : ''}><summary><span class="fn">${i + 1}</span><b>${esc(q.p)}</b>${ICON.mais}</summary><p>${md(q.r)}</p></details>`).join('')}
      </div>
    </div>
  </section>`;
}

function rodape() {
  return `
  <footer class="rodape">
    <div class="wrap">
      <img src="../assets/img/logo-75lab-lime.png" alt="75 LAB" width="82" height="58">
      <address>
        <a href="https://75lab.com.br" target="_blank" rel="noopener">www.75lab.com.br</a><br>
        Av. das Nações Unidas, 12.901 · São Paulo/SP<br>
        <a href="tel:+551150267313">11 5026-7313</a>
      </address>
      <div class="slogan">Ideia boa é a que acontece</div>
    </div>
  </footer>`;
}

// ---------------------------------------------------------------- montagem da página
const corpo = [capa(), objetivo(), montagem(), video(), ar(), medidas(), checklist(), faq()].join('');
// senha de acesso antes de mostrar qualquer conteúdo (e antes do questionário do QR)
const senhaHash = await exigirSenha(P);
$('#app').innerHTML = `
  <header class="top">
    <div class="wrap">
      <a class="logo" href="#topo" aria-label="75 LAB"><img src="../assets/img/logo-75lab-preto.png" alt="75 LAB" width="48" height="34"></a>
      <span class="slogan">Ideia boa é a que acontece</span>
      <button class="btn-reg" id="btn-reg" type="button">${ICON.reg}<span>Registrar instalação</span></button>
    </div>
    <nav class="chips" aria-label="Seções"><div class="wrap">${blocos.map(([id, nome]) => `<a href="#${id}">${nome}</a>`).join('')}</div></nav>
  </header>
  <main>${corpo}</main>
  ${rodape()}
  <div class="toast" role="status" aria-live="polite"></div>`;

let toastT;
export function toast(msg) {
  const el = $('.toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), 4200);
}

// seção ativa no menu
const links = [...document.querySelectorAll('.chips a')];
const io = new IntersectionObserver((ents) => {
  ents.forEach((e) => {
    if (!e.isIntersecting) return;
    links.forEach((a) => {
      const on = a.getAttribute('href') === '#' + e.target.id;
      a.classList.toggle('on', on);
      if (on) a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  });
}, { rootMargin: '-45% 0px -50% 0px' });
blocos.forEach(([id]) => io.observe(document.getElementById(id)));

// ---------------------------------------------------------------- checklist
(function () {
  const caixas = [...document.querySelectorAll('#checklist input[type=checkbox]')];
  if (!caixas.length) return;
  const chave = `check75:${P.slug}`;
  let salvo = [];
  try { salvo = JSON.parse(localStorage.getItem(chave) || '[]'); } catch {}
  caixas.forEach((c) => { c.checked = salvo.includes(Number(c.dataset.i)); });
  const atualizar = () => {
    const feitos = caixas.filter((c) => c.checked);
    $('#ck-feitos').textContent = feitos.length;
    $('#ck-barra').style.width = `${(feitos.length / caixas.length) * 100}%`;
    $('#ck-fim').hidden = feitos.length !== caixas.length;
    try { localStorage.setItem(chave, JSON.stringify(feitos.map((c) => Number(c.dataset.i)))); } catch {}
  };
  caixas.forEach((c) => c.addEventListener('change', atualizar));
  $('#ck-limpar').addEventListener('click', () => { caixas.forEach((c) => { c.checked = false; }); atualizar(); });
  atualizar();
})();

// ---------------------------------------------------------------- realidade aumentada
(async function () {
  const mv = $('model-viewer');
  if (!mv) return;
  const painel = (nome) => ['mobile', 'noar', 'desktop'].forEach((k) => { $(`#ar-${k}`).hidden = k !== nome; });
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) mv.removeAttribute('auto-rotate');

  // só baixa o visualizador 3D quando o bloco chega perto da tela
  const carregar = () => import(new URL('../vendor/model-viewer.min.js', import.meta.url).href);
  const perto = new IntersectionObserver((ents) => {
    if (ents.some((e) => e.isIntersecting)) { perto.disconnect(); carregar(); }
  }, { rootMargin: '600px 0px' });
  perto.observe(mv);

  const barra = $('#ar .progress');
  mv.addEventListener('progress', (e) => {
    const p = e.detail.totalProgress;
    barra.querySelector('i').style.width = `${Math.round(p * 100)}%`;
    barra.classList.toggle('done', p >= 1);
  });

  if (!isMobile) {
    painel('desktop');
    await import(new URL('../vendor/qrcode.min.js', import.meta.url).href).catch(() => {});
    if (window.qrcode) {
      const qr = window.qrcode(0, 'M');
      qr.addData(pageUrl + '#ar');
      qr.make();
      $('#qr-ar').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true, alt: 'QR code desta página' });
    }
    return;
  }

  painel('mobile');
  const cta = $('#cta-ar');
  const label = cta.querySelector('span');
  let pronto = false;
  const liberar = () => { pronto = true; cta.disabled = false; label.textContent = 'Ver no meu espaço'; };
  const esperarAR = (ms) => new Promise((res) => {
    const t0 = performance.now();
    (function ver() {
      if (mv.canActivateAR) return res(true);
      if (performance.now() - t0 > ms) return res(false);
      setTimeout(ver, 150);
    })();
  });
  mv.addEventListener('progress', (e) => { if (!pronto) label.textContent = `Carregando ${Math.round(e.detail.totalProgress * 100)}%`; });
  customElements.whenDefined('model-viewer').then(async () => {
    if (isIOS && P.ar.usdz && (await esperarAR(1500))) liberar(); // Quick Look abre o .usdz próprio
  });
  mv.addEventListener('load', async () => {
    if (pronto) return;
    if (await esperarAR(2500)) liberar();
    else painel('noar');
  });
  mv.addEventListener('error', () => { label.textContent = 'Não carregou'; });
  mv.addEventListener('ar-status', (e) => {
    if (e.detail.status === 'failed') toast('Não deu para abrir a realidade aumentada neste aparelho. Tente pelo Chrome (Android) ou Safari (iPhone).');
  });
  cta.addEventListener('click', () => mv.activateAR());
  $('#copiar')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(pageUrl); toast('Link copiado. Cole no Safari ou no Chrome.'); }
    catch { window.prompt('Copie o link:', pageUrl); }
  });
})();

// ---------------------------------------------------------------- registro de instalação (QR code)
iniciarRegistro(P, { toast, ICON, senhaHash });
