// Modelos pequenos de etiqueta com QR code, para peças onde a etiqueta 10 × 15 cm não cabe.
//   node tools/qr-modelos.mjs <pasta> [--livre]
// Gera em <pasta>/qr/:
//   selo-50.pdf/png   → 50 × 50 mm  · QR grande, uma linha de recado e o nome da peça
//   tira-70x30.pdf/png→ 70 × 30 mm  · faixa horizontal para lateral de caixa e testeira
//   mini-35.pdf/png   → 35 × 35 mm  · só o QR e a palavra que explica, para peça pequena
//   cartao-60x90.pdf/png → 60 × 90 mm · a etiqueta completa em metade do tamanho
// Todos saem em PDF (vetor, para a gráfica) e PNG 300 dpi (para mandar no WhatsApp).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import qrcode from 'qrcode-generator';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'))?.replace(/\/$/, '');
const livre = args.includes('--livre');
if (!slug || !existsSync(path.join(raiz, slug, 'index.html'))) {
  console.error('Uso: node tools/qr-modelos.mjs <pasta-da-pagina> [--livre]');
  process.exit(1);
}

const url = `https://projetos.75lab.com.br/produtos/${slug}/?qr=1`;
const html = readFileSync(path.join(raiz, slug, 'index.html'), 'utf8');
const P = JSON.parse(html.match(/<script type="application\/json" id="projeto">([\s\S]*?)<\/script>/)[1]);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const saida = path.join(raiz, slug, 'qr');
mkdirSync(saida, { recursive: true });

/* QR em nível M: menos módulos que o Q, então cada módulo fica maior na etiqueta pequena.
   A margem (quiet zone) de 4 módulos é obrigatória: sem ela o celular não lê. */
const qr = qrcode(0, 'M');
qr.addData(url);
qr.make();
const n = qr.getModuleCount();
let d = '';
for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x + 4},${y + 4}h1v1h-1z`;
const svgQR = (cor = '#0E1110') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 8} ${n + 8}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="${cor}"/></svg>`;

const logo = (f) => `data:image/png;base64,${readFileSync(path.join(raiz, 'assets/img', f)).toString('base64')}`;
const peca = P.nome;
const linhaPeca = P.linha && !/^pilhas/i.test(P.linha) ? P.linha : '';
const temKit = !!P.kit?.length;
// a frase muda com o que a pessoa vai encontrar do outro lado do código
const recado = temKit ? 'Marque as peças e veja a montagem' : 'Veja a montagem e registre a instalação';
const passos = [
  ...(livre ? [] : ['Senha de acesso']),
  ...(temKit ? ['Peças desta loja'] : []),
  'Loja e foto da fachada',
  'Montagem passo a passo',
];

const base = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Lexend',system-ui,sans-serif;color:#0E1110;background:#fff;display:flex}
.anton{font-family:'Anton',Impact,sans-serif;font-weight:400;text-transform:uppercase}
.qr svg{display:block;width:100%;height:100%}
.url{font-size:4.6pt;color:#9AA08F;word-break:break-all;letter-spacing:.1pt}
`;

const pagina = (w, h, css, corpo) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Lexend:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>@page{size:${w}mm ${h}mm;margin:0}html,body{width:${w}mm;height:${h}mm}${base}${css}</style>
</head><body>${corpo}</body></html>`;

/* ---------------------------------------------------------------- modelos */
const MODELOS = {
  // 50 × 50 mm: o equilíbrio entre pequeno e explicado. Vai na lateral da caixa.
  'selo-50': {
    w: 50, h: 50,
    css: `
      body{flex-direction:column;padding:3.6mm 3.6mm 3mm;border:.6mm solid #0E1110}
      .top{display:flex;align-items:center;justify-content:space-between}
      .top img{height:3.4mm}
      .top span{font-size:4.6pt;letter-spacing:.9pt}
      .qr{width:30mm;height:30mm;margin:1.6mm auto .4mm}
      .frase{font-size:6.4pt;line-height:1.2;text-align:center;font-weight:500}
      .pe{margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;gap:1.5mm}
      .pe b{font-size:6.2pt;font-weight:600;line-height:1.1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .pe i{font-style:normal;background:#C0EE4E;font-size:4.6pt;padding:.6mm 1.4mm;letter-spacing:.6pt;white-space:nowrap;flex:none}
    `,
    corpo: `
      <div class="top"><img src="${logo('logo-75lab-preto.png')}" alt="75 LAB"><span class="anton">Aponte a câmera</span></div>
      <div class="qr">${svgQR()}</div>
      <p class="frase">${esc(recado)}</p>
      <div class="pe"><b>${esc(peca)}</b><i class="anton">75 LAB</i></div>`,
  },
  // 70 × 30 mm: faixa para testeira, lateral de display e embalagem estreita.
  'tira-70x30': {
    w: 70, h: 30,
    css: `
      body{align-items:center;gap:3mm;padding:3mm;background:#C0EE4E}
      .qr{width:24mm;height:24mm;flex:none;background:#fff;padding:1mm}
      .txt{display:flex;flex-direction:column;gap:.8mm;min-width:0}
      .txt h1{font-size:11pt;line-height:.92;letter-spacing:-.2pt}
      .txt p{font-size:6pt;line-height:1.25;font-weight:500}
      .txt small{font-size:4.6pt;color:#3F4A33;letter-spacing:.2pt}
      .txt img{height:3.2mm;width:auto;align-self:flex-start;margin-top:.6mm}
    `,
    corpo: `
      <div class="qr">${svgQR()}</div>
      <div class="txt">
        <h1 class="anton">Monte<br>do jeito certo</h1>
        <p>${esc(recado)}</p>
        <small>${esc(peca)}</small>
        <img src="${logo('logo-75lab-preto.png')}" alt="75 LAB">
      </div>`,
  },
  // 35 × 35 mm: o menor que ainda lê bem. Para wobbler, precificador e blister.
  'mini-35': {
    w: 35, h: 35,
    css: `
      body{flex-direction:column;align-items:center;padding:2.2mm}
      .qr{width:26mm;height:26mm}
      .frase{font-size:5.4pt;font-weight:600;margin-top:.8mm;letter-spacing:.2pt}
      .frase i{font-style:normal;color:#9AA08F;font-weight:400}
    `,
    corpo: `
      <div class="qr">${svgQR()}</div>
      <p class="frase anton">Montagem <i>· 75 LAB</i></p>`,
  },
  // 60 × 90 mm: a etiqueta completa, com os passos, na metade do tamanho da original.
  'cartao-60x90': {
    w: 60, h: 90,
    css: `
      body{flex-direction:column;padding:4.5mm;background:#C0EE4E}
      .top{display:flex;align-items:center;justify-content:space-between}
      .top img{height:4.2mm}
      .top span{font-size:5pt;letter-spacing:1pt}
      h1{font-size:12pt;line-height:.95;margin-top:2.6mm;font-weight:300;text-transform:uppercase;letter-spacing:-.2pt}
      h1 b{display:block;font-weight:600}
      .cx{background:#fff;padding:2.4mm;margin-top:2.4mm}
      .qr{width:34mm;height:34mm;margin:0 auto}
      ol{list-style:none;display:grid;gap:.9mm;margin-top:1.8mm}
      li{display:flex;gap:1.6mm;align-items:center;font-size:5.6pt;line-height:1.15}
      li i{font-style:normal;background:#0E1110;color:#C0EE4E;width:3.2mm;height:3.2mm;flex:none;display:grid;place-items:center;font-size:4.6pt;border-radius:50%}
      .pe{margin-top:auto;background:#0E1110;color:#fff;padding:2.2mm 2.8mm}
      .pe small{display:block;font-size:4.6pt;letter-spacing:1pt;color:#C0EE4E}
      .pe b{display:block;font-size:7.4pt;font-weight:500;margin-top:.6mm}
      .pe span{display:block;font-size:4.4pt;color:#9AA08F;margin-top:.8mm;word-break:break-all}
    `,
    corpo: `
      <div class="top"><img src="${logo('logo-75lab-preto.png')}" alt="75 LAB"><span class="anton">Ideia boa é a que acontece</span></div>
      <h1>Escaneie <b>antes de montar</b></h1>
      <div class="cx">
        <div class="qr">${svgQR()}</div>
        <ol>${passos.map((t, i) => `<li><i class="anton">${i + 1}</i><span>${esc(t)}</span></li>`).join('')}</ol>
      </div>
      <div class="pe"><small class="anton">${esc(P.cliente)}</small><b>${esc(peca)}</b><span>projetos.75lab.com.br/produtos/${esc(slug)}</span></div>`,
  },
};

mkdirSync(path.join(raiz, '.work'), { recursive: true });
const navegador = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-first-run', '--hide-scrollbars'],
});
try {
  const page = await navegador.newPage();
  for (const [nome, m] of Object.entries(MODELOS)) {
    const sufixo = livre ? '-livre' : '';
    const tmp = path.join(raiz, '.work', `${nome}-${slug}${sufixo}.html`);
    writeFileSync(tmp, pagina(m.w, m.h, m.css, m.corpo));
    // 1 mm = 3.7795 px CSS; deviceScaleFactor 3.125 leva o PNG a 300 dpi
    await page.setViewport({ width: Math.round(m.w * 3.7795), height: Math.round(m.h * 3.7795), deviceScaleFactor: 3.125 });
    await page.goto(`file://${tmp}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: path.join(saida, `${nome}${sufixo}.pdf`), width: `${m.w}mm`, height: `${m.h}mm`, printBackground: true, pageRanges: '1' });
    await page.screenshot({ path: path.join(saida, `${nome}${sufixo}.png`) });
    console.log(`${nome}${sufixo}  ${m.w} × ${m.h} mm`);
  }
} finally {
  await navegador.close();
}
console.log(`\nQR → ${url}\nArquivos em ${slug}/qr/`);
