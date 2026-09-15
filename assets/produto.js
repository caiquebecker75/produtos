// Página de produto 75 LAB — monta a página a partir do JSON <script type="application/json" id="projeto">.
// Peça única: os blocos ficam na raiz do JSON. Enxoval (várias peças): "kit": [{ id, nome, ...blocos da peça }]
// — depois da senha, a pessoa escolhe as peças que vai executar e a página mostra só essas
// (o registro de instalação guarda quais foram). Blocos sem dados simplesmente não aparecem.
// Texto aceita **negrito**. Ver modelo/index.html para os campos.
import { iniciarRegistro } from './registro.js?v=8';
import { exigirSenha, pecasDesligadas, telaSemPecas } from './acesso.js?v=4';
import { escolherPecas } from './selecao.js?v=2';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const P = JSON.parse($('#projeto').textContent);
const KIT = Array.isArray(P.kit) && P.kit.length ? P.kit : null;
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
  pecas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
};

const dimsChips = (X) => (X.medidas?.principais || [])
  .map((d) => `<span>${esc(d.rotulo)}<b>${esc(d.valor)}${d.unidade ? ' ' + esc(d.unidade) : ''}</b></span>`).join('');

// ---------------------------------------------------------------- blocos
// X = objeto com os dados (o projeto, ou uma peça do enxoval) · pre = prefixo dos ids · nav(id, nome) = item do menu
function capa(sel) {
  const escolhidas = KIT ? KIT.filter((x) => sel.includes(x.id)) : [];
  const dims = KIT ? '' : dimsChips(P);
  return `
  <section class="hero" id="topo">
    <div class="hero-card">
      <div class="hero-txt">
        ${P.logoCliente ? `<img class="cliente-logo" src="${esc(P.logoCliente)}" alt="${esc(P.cliente)}">` : `<div class="cliente-nome">${esc(P.cliente)}</div>`}
        <h1>${esc(P.nome)}${P.linha ? ` <b>${esc(P.linha)}</b>` : ''}</h1>
        <p class="sub">${esc(P.subtitulo || 'Treinamento de montagem')}</p>
        ${P.tipo ? `<p class="tipo">${esc(P.tipo)}</p>` : ''}
        ${dims ? `<div class="dims">${dims}</div>` : ''}
        ${KIT ? `
        <div class="kit-sel">
          <small>Peças desta execução · ${escolhidas.length} de ${KIT.length}</small>
          <div class="kit-chips">${escolhidas.map((x) => `<a href="#${esc(x.id)}">${esc(x.nomeCurto || x.nome)}</a>`).join('')}</div>
          <button type="button" class="kit-trocar" data-trocar-pecas>${ICON.pecas}Trocar peças</button>
        </div>` : ''}
      </div>
      <div class="hero-img">${P.imagem ? `<img src="${esc(P.imagem)}" alt="${esc(P.nome)} ${esc(P.linha || '')}">` : ''}</div>
    </div>
  </section>`;
}

function objetivo(X, pre, nav) {
  const o = X.objetivo;
  if (!o) return '';
  const id = `${pre}objetivo`;
  nav(id, 'Objetivo');
  const pontos = (o.pontos || []).map((p, i) => `<li><span class="n">${dois(i + 1)}</span><strong>${esc(p.titulo)}</strong><span>${md(p.texto)}</span></li>`).join('');
  return `
  <section class="sec" id="${id}">
    <div class="wrap obj">
      <div class="obj-txt">
        <div class="eyebrow">${KIT && X === P ? 'Objetivo do enxoval' : 'Objetivo da peça'}</div>
        <h2 class="h2">Para que <b>serve</b></h2>
        <p>${md(o.texto)}</p>
      </div>
      ${pontos ? `<ol class="pontos">${pontos}</ol>` : ''}
    </div>
  </section>`;
}

function capitulo(X, i, n) {
  const dims = dimsChips(X);
  return `
  <section class="peca-cap" id="${esc(X.id)}">
    <div class="wrap peca-cap-in">
      <div class="peca-cap-txt">
        <div class="peca-num">Peça ${dois(i + 1)}<small>/${dois(n)}</small></div>
        <h2>${esc(X.nome)}${X.linha ? ` <b>${esc(X.linha)}</b>` : ''}</h2>
        ${X.tipo ? `<p class="peca-tipo">${esc(X.tipo)}</p>` : ''}
        ${dims ? `<div class="dims">${dims}</div>` : ''}
        ${X.objetivo?.texto ? `<p class="peca-obj">${md(X.objetivo.texto)}</p>` : ''}
      </div>
      <div class="peca-cap-img">${X.imagem ? `<img src="${esc(X.imagem)}" alt="${esc(X.nome)}" loading="lazy">` : ''}</div>
    </div>
  </section>`;
}

function galeria(X, pre, nav) {
  const g = X.galeria || [];
  if (!g.length) return '';
  const id = `${pre}vistas`;
  nav(id, 'Vistas');
  return `
  <section class="sec vistas" id="${id}">
    <div class="wrap">
      <div class="eyebrow">Conheça a peça</div>
      <h2 class="h2">Vistas <b>${esc(X.tituloVistas || (KIT ? 'da peça' : 'do display'))}</b></h2>
      <p class="lead">Toque na imagem para ampliar${g.length > 1 ? '<span class="so-celular">. Arraste para o lado para ver as outras</span>' : ''}.</p>
      <div class="galeria">
        ${g.map((it, i) => `
        <figure>
          <button type="button" class="gal-item" data-galeria="${esc(pre)}" data-gal="${i}" aria-label="Ampliar: ${esc(it.legenda || X.nome)}">
            <img src="${esc(it.src)}" alt="${esc(it.legenda || X.nome)}" loading="lazy">
          </button>
          ${it.legenda ? `<figcaption>${esc(it.legenda)}</figcaption>` : ''}
        </figure>`).join('')}
      </div>
    </div>
  </section>`;
}

function montagem(X, pre, nav) {
  const passos = X.montagem || [];
  if (!passos.length) return '';
  const id = `${pre}montagem`;
  nav(id, 'Montagem');
  const caixa = (X.caixa || (!KIT ? X.pecas : null) || []).map((p) => `<li><b>${esc(p.qtd)}×</b>${md(p.nome)}</li>`).join('');
  const img = X.imagemMontado || X.imagem;
  return `
  <section class="sec dark" id="${id}">
    <div class="wrap">
      <div class="eyebrow">Instruções de montagem</div>
      <h2 class="h2">${KIT ? `${esc(X.nomeCurto || X.nome)}: <b>como instalar</b>` : 'Montagem <b>do material</b>'}</h2>
      ${X.tempoMontagem ? `<p class="lead">Tempo médio: <b>${esc(X.tempoMontagem)}</b>. Siga os passos na ordem.</p>` : '<p class="lead">Siga os passos na ordem, sem pular etapas.</p>'}
      <div class="mont">
        <div style="display:grid;gap:12px">
          ${caixa ? `<div class="caixa"><h3>O que vem na caixa</h3><ul>${caixa}</ul>${X.ferramentas ? `<p class="obs">${md(X.ferramentas)}</p>` : ''}</div>` : ''}
          <ol class="passos">
            ${passos.map((p, i) => `
            <li class="passo">
              <div class="num"><small>Passo</small><i>${i + 1}</i></div>
              <div><h3>${esc(p.titulo)}</h3><p>${md(p.texto)}</p>${p.alerta ? `<p class="alerta">${md(p.alerta)}</p>` : ''}</div>
            </li>`).join('')}
          </ol>
        </div>
        <div class="mont-img">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ''}</div>
      </div>
    </div>
  </section>`;
}

function video(X, pre, nav) {
  const v = X.video;
  if (!v || !(v.mp4 || v.youtube || v.pendente)) return '';
  const id = `${pre}video`;
  nav(id, 'Vídeo');
  const vert = v.orientacao === 'vertical';
  const player = v.pendente
    ? `<div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:24px;color:#9AA08F;font-size:14px;background:#1B201D">${v.poster ? `<img src="${esc(v.poster)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.35">` : ''}<span style="position:relative">${md(v.pendente)}</span></div>`
    : v.youtube
      ? `<iframe src="https://www.youtube-nocookie.com/embed/${esc(v.youtube)}?rel=0&playsinline=1" title="Vídeo de montagem" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>`
      : `<video controls playsinline preload="metadata" ${v.poster ? `poster="${esc(v.poster)}"` : ''}><source src="${esc(v.mp4)}" type="video/mp4"></video>`;
  return `
  <section class="sec dark video" id="${id}" style="padding-top:0">
    <div class="wrap">
      <div class="video-box ${vert ? 'vert' : ''}">
        <div class="player ${vert ? 'v' : 'h'}">${player}</div>
        <div class="video-info">
          <div class="eyebrow">Vídeo de montagem</div>
          <h2 class="h2">Veja <b>passo a passo</b></h2>
          <p class="lead">${md(v.texto || 'Assista antes de abrir a embalagem: a montagem fica mais rápida e sem retrabalho.')}</p>
          ${v.duracao ? `<p class="dur">Duração ${esc(v.duracao)}</p>` : ''}
          ${v.capitulos?.length && v.mp4 ? `<ol class="capitulos">${v.capitulos.map((c) => `<li><button type="button" data-t="${Number(c.t) || 0}"><span>${Math.floor(c.t / 60)}:${String(Math.floor(c.t % 60)).padStart(2, '0')}</span>${esc(c.titulo)}</button></li>`).join('')}</ol>` : ''}
        </div>
      </div>
    </div>
  </section>`;
}

function ar(X, pre, nav) {
  const a = X.ar;
  if (!a || !a.glb) return '';
  const id = `${pre}ar`;
  nav(id, 'Ver no local');
  return `
  <section class="sec ar" id="${id}" data-ar="${esc(pre)}">
    <div class="wrap">
      <div class="eyebrow">Realidade aumentada</div>
      <h2 class="h2">Veja no <b>seu espaço</b></h2>
      <p class="lead">Antes de montar, coloque ${KIT ? `o <b>${esc(X.nomeCurto || X.nome)}</b>` : 'a peça'} em <b>tamanho real</b> na loja pela câmera do celular e confira se o local escolhido funciona: passagem, altura, gôndola e visibilidade.</p>
      <div class="ar-grid">
        <div class="stage">
          <model-viewer alt="${esc(X.nome)} em 3D" src="${esc(a.glb)}" ${a.usdz ? `ios-src="${esc(a.usdz)}"` : ''} ${a.poster ? `poster="${esc(a.poster)}"` : ''}
            ar ar-modes="webxr scene-viewer quick-look" ar-scale="fixed" ar-placement="${esc(a.posicionamento || 'floor')}" xr-environment
            camera-controls auto-rotate auto-rotate-delay="2500" rotation-per-second="14deg"
            camera-orbit="${esc(a.orbita || '28deg 78deg auto')}" min-camera-orbit="auto 25deg auto" max-camera-orbit="auto 92deg auto"
            interaction-prompt="none" shadow-intensity="1.1" shadow-softness="0.9" environment-image="neutral" exposure="1.05" loading="lazy">
            <button slot="ar-button" hidden></button>
            <div slot="progress-bar"></div>
            <div slot="ar-prompt" class="ar-prompt">Aponte para ${a.posicionamento === 'wall' ? 'a <b>parede ou gôndola</b>' : 'o <b>chão</b>'} e mova o celular devagar</div>
          </model-viewer>
          <div class="drag">${ICON.girar}Arraste para girar</div>
          <div class="progress"><i></i></div>
        </div>
        <div>
          <div class="ar-mobile">
            <button class="cta cta-ar" type="button" disabled>${ICON.ar}<span>Carregando 3D</span></button>
            <ul class="ar-dicas">
              <li><span>1</span>Vá até o ponto onde a peça vai ficar e aponte a câmera para ${a.posicionamento === 'wall' ? 'a superfície' : 'o chão'}.</li>
              <li><span>2</span>Mova o celular devagar até a peça aparecer, em tamanho real.</li>
              <li><span>3</span>Ande ao redor: confira corredor, altura e se nada tampa a visão do shopper.</li>
            </ul>
          </div>
          <div class="ar-noar" hidden>
            <div class="note"><strong>Abra no navegador</strong>Para ver em realidade aumentada, abra este link no <b>Safari</b> (iPhone) ou no <b>Chrome</b> (Android).</div>
            <button class="ghost copiar" type="button">Copiar link</button>
          </div>
          <div class="ar-desktop" hidden>
            <div class="qrcard"><div class="qr qr-ar"></div><div><strong>Abra no celular</strong><p>Aponte a câmera do celular para o código e toque em <b>Ver no meu espaço</b>.</p></div></div>
            <ul class="ar-dicas">
              <li><span>1</span>Leve o celular até o ponto da loja onde a peça vai ficar.</li>
              <li><span>2</span>Aponte a câmera e mova o aparelho devagar.</li>
              <li><span>3</span>A peça aparece em tamanho real: ande ao redor e confira o espaço.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function medidas(X, pre, nav) {
  const m = X.medidas;
  if (!m) return '';
  const id = `${pre}medidas`;
  nav(id, 'Medidas');
  const big = (m.principais || []).map((d) => `<div><small>${esc(d.rotulo)}</small><b>${esc(d.valor)}</b><em>${esc(d.unidade || '')}</em></div>`).join('');
  const grupos = (m.grupos || []).map((g) => `
    <section>
      <h3>${esc(g.titulo)}</h3>
      ${g.texto ? `<p>${md(g.texto)}</p>` : ''}
      ${g.itens?.length ? `<dl>${g.itens.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${md(v)}</dd></div>`).join('')}</dl>` : ''}
    </section>`).join('');
  return `
  <section class="sec medidas" id="${id}">
    <div class="wrap">
      <div class="eyebrow">Dimensional</div>
      <h2 class="h2">Medidas <b>e ficha técnica</b></h2>
      <div class="med-grid">
        ${m.desenho ? `<figure class="desenho"><img src="${esc(m.desenho)}" alt="Desenho técnico com as medidas" loading="lazy">${m.legenda ? `<figcaption>${esc(m.legenda)}</figcaption>` : ''}</figure>` : ''}
        ${m.planificado ? `<figure class="desenho planificado"><button type="button" class="gal-item" data-zoom="${esc(m.planificado)}" data-legenda="${esc(m.legendaPlanificado || 'Arte planificada')}" aria-label="Ampliar a arte planificada"><img src="${esc(m.planificado)}" alt="Arte planificada da peça" loading="lazy"></button><figcaption>${esc(m.legendaPlanificado || 'Arte planificada: toque para ampliar')}</figcaption></figure>` : ''}
        <div>
          ${big ? `<div class="big-dims">${big}</div>` : ''}
          <div class="ficha">${grupos}</div>
        </div>
      </div>
    </div>
  </section>`;
}

function checklist(X, pre, nav) {
  const grupos = X.checklist || [];
  if (!grupos.length) return '';
  const id = `${pre}checklist`;
  nav(id, 'Checklist');
  let n = 0;
  const html = grupos.map((g) => `
    <div class="grupo-check">
      <h3>${esc(g.grupo)}</h3>
      ${g.itens.map((t) => `<label class="item"><input type="checkbox" data-i="${n++}"><span class="box">${ICON.check}</span><span>${md(t)}</span></label>`).join('')}
    </div>`).join('');
  return `
  <section class="sec check" id="${id}" data-chave="check75:${esc(P.slug)}${KIT ? ':' + esc(X.id) : ''}">
    <div class="wrap">
      <div class="eyebrow">Checklist de execução</div>
      <h2 class="h2">Antes de <b>ir embora</b></h2>
      <p class="lead">Marque cada item conforme conclui. Fica salvo neste celular.</p>
      <div class="check-card">
        <div class="check-head">
          <div class="contagem"><span class="ck-feitos">0</span>/${n}<small>itens</small></div>
          <div class="barra"><i class="ck-barra"></i></div>
          <button type="button" class="link-btn ck-limpar">Limpar</button>
        </div>
        ${html}
        <div class="check-fim" hidden>${ICON.check}<div><b>Execução completa</b><div style="font-size:14px;color:#C9CDC3">Tudo conferido. Se ainda não registrou a instalação, toque em <b style="font-family:inherit;text-transform:none;letter-spacing:0;font-size:inherit;font-weight:500">Registrar instalação</b> no topo.</div></div></div>
      </div>
    </div>
  </section>`;
}

function faq(X, pre, nav) {
  const f = X.faq || [];
  if (!f.length) return '';
  const id = `${pre}faq`;
  nav(id, 'FAQ');
  return `
  <section class="sec dark" id="${id}">
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

const blocosDaPeca = (X, pre, nav) =>
  [galeria(X, pre, nav), montagem(X, pre, nav), video(X, pre, nav), ar(X, pre, nav), medidas(X, pre, nav), checklist(X, pre, nav)].join('');

// ---------------------------------------------------------------- página
let toastT;
export function toast(msg) {
  const el = $('.toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('on'), 4200);
}

const LISTAS = {};   // galerias por prefixo, para o zoom
let ioMenu = null;

function renderizar(sel) {
  const menu = [];
  let corpo = capa(sel);
  if (KIT) {
    const semMenu = () => {};
    corpo += objetivo(P, '', semMenu);
    const escolhidas = KIT.filter((x) => sel.includes(x.id));
    escolhidas.forEach((X, i) => {
      menu.push([X.id, X.nomeCurto || X.nome]);
      LISTAS[`${X.id}-`] = X.galeria || [];
      corpo += capitulo(X, i, escolhidas.length) + blocosDaPeca(X, `${X.id}-`, semMenu) + faq(X, `${X.id}-`, semMenu);
    });
    corpo += faq(P, '', (id) => menu.push([id, 'FAQ']));
  } else {
    const nav = (id, nome) => menu.push([id, nome]);
    LISTAS[''] = P.galeria || [];
    corpo += objetivo(P, '', nav) + blocosDaPeca(P, '', nav) + faq(P, '', nav);
  }
  $('#app').innerHTML = `
  <header class="top">
    <div class="wrap">
      <a class="logo" href="#topo" aria-label="75 LAB"><img src="../assets/img/logo-75lab-preto.png" alt="75 LAB" width="48" height="34"></a>
      <span class="slogan">Ideia boa é a que acontece</span>
      <button class="btn-reg" id="btn-reg" type="button">${ICON.reg}<span>Registrar instalação</span></button>
    </div>
    <nav class="chips" aria-label="Seções"><div class="wrap">${menu.map(([id, nome]) => `<a href="#${esc(id)}">${esc(nome)}</a>`).join('')}</div></nav>
  </header>
  <main>${corpo}</main>
  ${rodape()}
  <div class="toast" role="status" aria-live="polite"></div>`;

  // seção ativa no menu
  ioMenu?.disconnect();
  const links = $$('.chips a');
  ioMenu = new IntersectionObserver((ents) => {
    ents.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => {
        const on = a.getAttribute('href') === '#' + e.target.id;
        a.classList.toggle('on', on);
        if (on) a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  menu.forEach(([id]) => { const el = document.getElementById(id); if (el) ioMenu.observe(el); });

  $$('section.check').forEach(iniciarChecklist);
  $$('section[data-ar]').forEach((sec) => iniciarAR(sec, KIT ? KIT.find((x) => `${x.id}-` === sec.dataset.ar) : P));
  $$('section.video').forEach(iniciarCapitulos);
}

// ---------------------------------------------------------------- checklist
function iniciarChecklist(sec) {
  const caixas = $$('input[type=checkbox]', sec);
  if (!caixas.length) return;
  const chave = sec.dataset.chave;
  let salvo = [];
  try { salvo = JSON.parse(localStorage.getItem(chave) || '[]'); } catch {}
  caixas.forEach((c) => { c.checked = salvo.includes(Number(c.dataset.i)); });
  const atualizar = () => {
    const feitos = caixas.filter((c) => c.checked);
    $('.ck-feitos', sec).textContent = feitos.length;
    $('.ck-barra', sec).style.width = `${(feitos.length / caixas.length) * 100}%`;
    $('.check-fim', sec).hidden = feitos.length !== caixas.length;
    try { localStorage.setItem(chave, JSON.stringify(feitos.map((c) => Number(c.dataset.i)))); } catch {}
  };
  caixas.forEach((c) => c.addEventListener('change', atualizar));
  $('.ck-limpar', sec).addEventListener('click', () => { caixas.forEach((c) => { c.checked = false; }); atualizar(); });
  atualizar();
}

// ---------------------------------------------------------------- realidade aumentada
let pedidoMV = null;
const carregarMV = () => (pedidoMV ??= import(new URL('../vendor/model-viewer.min.js', import.meta.url).href));

async function iniciarAR(sec, X) {
  const mv = $('model-viewer', sec);
  if (!mv || !X) return;
  const painel = (nome) => ['mobile', 'noar', 'desktop'].forEach((k) => { $(`.ar-${k}`, sec).hidden = k !== nome; });
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) mv.removeAttribute('auto-rotate');

  // só baixa o visualizador 3D quando o bloco chega perto da tela (com garantia de tempo para navegadores embutidos)
  const perto = new IntersectionObserver((ents) => {
    if (ents.some((e) => e.isIntersecting)) { perto.disconnect(); carregarMV(); }
  }, { rootMargin: '600px 0px' });
  perto.observe(mv);
  setTimeout(() => { perto.disconnect(); carregarMV(); }, 5000);

  const barra = $('.progress', sec);
  mv.addEventListener('progress', (e) => {
    const p = e.detail.totalProgress;
    barra.querySelector('i').style.width = `${Math.round(p * 100)}%`;
    barra.classList.toggle('done', p >= 1);
  });
  const link = KIT ? `${pageUrl}?pecas=${encodeURIComponent(X.id)}#${sec.id}` : `${pageUrl}#${sec.id}`;

  if (!isMobile) {
    painel('desktop');
    await import(new URL('../vendor/qrcode.min.js', import.meta.url).href).catch(() => {});
    if (window.qrcode) {
      const qr = window.qrcode(0, 'M');
      qr.addData(link);
      qr.make();
      $('.qr-ar', sec).innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true, alt: 'QR code desta página' });
    }
    return;
  }

  painel('mobile');
  const cta = $('.cta-ar', sec);
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
    if (isIOS && X.ar.usdz && (await esperarAR(1500))) liberar(); // Quick Look abre o .usdz próprio
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
  $('.copiar', sec)?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(link); toast('Link copiado. Cole no Safari ou no Chrome.'); }
    catch { window.prompt('Copie o link:', link); }
  });
}

// ---------------------------------------------------------------- capítulos do vídeo
function iniciarCapitulos(sec) {
  const player = $('video', sec);
  if (!player) return;
  const botoes = $$('.capitulos button', sec);
  botoes.forEach((b) => b.addEventListener('click', () => {
    player.currentTime = Number(b.dataset.t);
    player.play().catch(() => {});
    player.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }));
  player.addEventListener('timeupdate', () => {
    let ativo = -1;
    botoes.forEach((b, i) => { if (player.currentTime >= Number(b.dataset.t)) ativo = i; });
    botoes.forEach((b, i) => b.classList.toggle('on', i === ativo));
  });
}

// ---------------------------------------------------------------- ampliar imagens (galeria e planificado)
(function () {
  let atual = 0;
  let tela = null;
  const fechar = () => { tela?.remove(); tela = null; document.body.style.overflow = ''; };
  function mostrar(lista, i) {
    atual = (i + lista.length) % lista.length;
    const it = lista[atual];
    if (!tela) {
      tela = document.createElement('div');
      tela.className = 'zoom';
      tela.setAttribute('role', 'dialog');
      tela.setAttribute('aria-modal', 'true');
      document.body.appendChild(tela);
      document.body.style.overflow = 'hidden';
    }
    tela.innerHTML = `
      <button type="button" class="zoom-fechar" aria-label="Fechar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      <figure><img src="${esc(it.src)}" alt="${esc(it.legenda || '')}">${it.legenda ? `<figcaption>${esc(it.legenda)}</figcaption>` : ''}</figure>
      ${lista.length > 1 ? `<button type="button" class="zoom-nav ant" aria-label="Anterior">‹</button><button type="button" class="zoom-nav prox" aria-label="Próxima">›</button><div class="zoom-conta">${atual + 1}/${lista.length}</div>` : ''}`;
    tela.querySelector('.zoom-fechar').onclick = fechar;
    tela.querySelector('.ant')?.addEventListener('click', () => mostrar(lista, atual - 1));
    tela.querySelector('.prox')?.addEventListener('click', () => mostrar(lista, atual + 1));
    let x0 = null;
    tela.ontouchstart = (e) => { x0 = e.touches[0].clientX; };
    tela.ontouchend = (e) => {
      if (x0 == null || lista.length < 2) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) mostrar(lista, atual + (dx < 0 ? 1 : -1));
      x0 = null;
    };
    tela._lista = lista;
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-gal],[data-zoom]');
    if (!b) return;
    if (b.dataset.zoom) mostrar([{ src: b.dataset.zoom, legenda: b.dataset.legenda || 'Arte planificada' }], 0);
    else mostrar(LISTAS[b.dataset.galeria || ''] || [], Number(b.dataset.gal));
  });
  document.addEventListener('keydown', (e) => {
    if (!tela) return;
    if (e.key === 'Escape') fechar();
    if (e.key === 'ArrowRight') mostrar(tela._lista, atual + 1);
    if (e.key === 'ArrowLeft') mostrar(tela._lista, atual - 1);
  });
})();

// ---------------------------------------------------------------- fluxo: senha → peças (enxoval) → página → registro
const senhaHash = await exigirSenha(P);

// peças desabilitadas no painel somem da escolha, da página e do registro (KIT e P.kit são o mesmo array)
if (KIT) {
  const off = pecasDesligadas(P.slug);
  for (let i = KIT.length - 1; i >= 0; i--) if (off.includes(KIT[i].id)) KIT.splice(i, 1);
  if (!KIT.length) {
    telaSemPecas(P);
    await new Promise(() => {});
  }
}

let selecionadas = [];
const chaveSel = `sel75:${P.slug}`;
function guardarSelecao(sel) {
  selecionadas = sel;
  try { localStorage.setItem(chaveSel, JSON.stringify(sel)); } catch {}
  const u = new URL(location.href);
  u.searchParams.set('pecas', sel.join(','));
  history.replaceState(null, '', u.pathname + u.search + u.hash);
}
if (KIT) {
  const validas = (lista) => (lista || []).filter((id) => KIT.some((x) => x.id === id));
  const daUrl = validas((new URLSearchParams(location.search).get('pecas') || '').split(','));
  let anterior = [];
  try { anterior = validas(JSON.parse(localStorage.getItem(chaveSel) || '[]')); } catch {}
  // link com ?pecas= (ex.: QR do AR de uma peça) abre direto; QR do enxoval sempre pergunta
  // só uma peça habilitada: não há o que escolher
  const sel = KIT.length === 1 ? [KIT[0].id]
    : daUrl.length && !new URLSearchParams(location.search).has('qr') ? daUrl : await escolherPecas(P, { inicial: daUrl.length ? daUrl : anterior });
  guardarSelecao(sel);
}

let montada = false;
const registro = iniciarRegistro(P, {
  toast, ICON, senhaHash,
  pecas: () => (KIT ? selecionadas : []),
  nomesPecas: () => (KIT ? KIT.filter((x) => selecionadas.includes(x.id)).map((x) => x.nomeCurto || x.nome) : []),
  trocarPecas: KIT ? () => trocar() : null,
});

// registro obrigatório antes de abrir a página (QR ou link): pula só se este aparelho já registrou estas peças nas últimas 12 h
await registro.exigir();
renderizar(selecionadas);
montada = true;
registro.atualizarBotao();

async function trocar() {
  const sel = await escolherPecas(P, { inicial: selecionadas, cancelavel: true });
  if (!sel) return;
  guardarSelecao(sel);
  if (!montada) return; // trocou dentro do registro obrigatório: a página ainda não abriu
  renderizar(sel);
  registro.atualizarBotao();
  window.scrollTo({ top: 0, behavior: 'instant' });
  toast(`Página com ${sel.length} peça${sel.length > 1 ? 's' : ''}.`);
  if (!registro.jaRegistrou()) registro.abrir(); // peça que ainda não foi registrada nesta loja
}
document.addEventListener('click', (e) => { if (e.target.closest('[data-trocar-pecas]') && !e.target.closest('.sheet')) trocar(); });
