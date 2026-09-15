// QR code de uma página de produto, para imprimir e mandar junto com a peça.
//   node tools/qr.mjs <pasta>
// Gera em <pasta>/qr/:
//   qr-code.svg / qr-code.png  → só o código (2048 px), para a arte da embalagem
//   etiqueta.pdf / etiqueta.png → etiqueta pronta 10 × 15 cm com a identidade 75 LAB (PNG em 300 dpi)
// O QR abre a página com ?qr=1: pede nome, telefone e loja e pega a localização.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import qrcode from 'qrcode-generator';
import sharp from 'sharp';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2]?.replace(/\/$/, '');
if (!slug || !existsSync(path.join(raiz, slug, 'index.html'))) {
  console.error('Uso: node tools/qr.mjs <pasta-da-pagina>');
  process.exit(1);
}
const url = `https://projetos.75lab.com.br/produtos/${slug}/?qr=1`;
const html = readFileSync(path.join(raiz, slug, 'index.html'), 'utf8');
const P = JSON.parse(html.match(/<script type="application\/json" id="projeto">([\s\S]*?)<\/script>/)[1]);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const saida = path.join(raiz, slug, 'qr');
mkdirSync(saida, { recursive: true });

// nível Q (25% de correção): aguenta arranhão e dobra na impressão
const qr = qrcode(0, 'Q');
qr.addData(url);
qr.make();
const n = qr.getModuleCount();
let rects = '';
for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) rects += `M${x + 4},${y + 4}h1v1h-1z`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + 8} ${n + 8}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${rects}" fill="#0E1110"/></svg>`;
writeFileSync(path.join(saida, 'qr-code.svg'), svg);
await sharp(Buffer.from(svg), { density: 1200 }).resize(2048, 2048, { kernel: 'nearest' }).png().toFile(path.join(saida, 'qr-code.png'));

// etiqueta
const logo = (f) => `data:image/png;base64,${readFileSync(path.join(raiz, 'assets/img', f)).toString('base64')}`;
const etiqueta = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Lexend:wght@200;300;500;600&display=swap" rel="stylesheet">
<style>
@page { size: 100mm 150mm; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100mm; height: 150mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: 'Lexend', sans-serif; color: #0E1110; background: #C0EE4E; display: flex; flex-direction: column; padding: 7mm; }
.top { display: flex; justify-content: space-between; align-items: center; }
.top img { height: 8mm; }
.top span { font-family: 'Anton', sans-serif; font-size: 7pt; letter-spacing: 1.4pt; text-transform: uppercase; }
h1 { font-weight: 200; text-transform: uppercase; font-size: 22pt; line-height: .95; margin-top: 6mm; letter-spacing: -.3pt; }
h1 b { font-weight: 600; display: block; }
.qr { background: #fff; border-radius: 5mm; padding: 3mm 4mm 4mm; margin-top: 5mm; }
.qr svg { width: 56mm; height: 56mm; display: block; margin: 0 auto; }
.qr ol { list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 3mm; font-size: 7pt; line-height: 1.25; margin-top: 2mm; }
.qr li { display: flex; gap: 2mm; align-items: baseline; }
.qr li i { font-style: normal; font-family: 'Anton', sans-serif; background: #0E1110; color: #C0EE4E; border-radius: 50%; width: 4.2mm; height: 4.2mm; flex: none; display: grid; place-items: center; font-size: 6.5pt; }
.peca { margin-top: auto; background: #0E1110; color: #fff; border-radius: 5mm; padding: 4mm 5mm; }
.peca small { display: block; font-family: 'Anton', sans-serif; font-size: 6.5pt; letter-spacing: 1.4pt; text-transform: uppercase; color: #C0EE4E; }
.peca b { display: block; font-weight: 500; font-size: 11pt; margin-top: 1mm; }
.peca span { display: block; font-size: 6.5pt; color: #9AA08F; margin-top: 1.4mm; word-break: break-all; }
</style></head><body>
<div class="top"><img src="${logo('logo-75lab-preto.png')}" alt="75 LAB"><span>Ideia boa é a que acontece</span></div>
<h1>Escaneie <b>antes de montar</b></h1>
<div class="qr">${svg}<ol>
  ${['Digite a senha de acesso passada pelo responsável', 'Registre a loja onde a peça vai ficar',
      ...(P.ar?.glb ? ['Veja a peça no local em realidade aumentada'] : []), 'Siga o passo a passo e o checklist']
    .map((t, i) => `<li><i>${i + 1}</i><span>${t}</span></li>`).join('')}
</ol></div>
<div class="peca"><small>${esc(P.cliente)}</small><b>${esc(P.nome)} ${esc(P.linha || '')}</b><span>projetos.75lab.com.br/produtos/${esc(slug)}</span></div>
</body></html>`;
const tmp = path.join(raiz, '.work', `etiqueta-${slug}.html`);
mkdirSync(path.dirname(tmp), { recursive: true });
writeFileSync(tmp, etiqueta);

// Chrome controlado pelo puppeteer (o Chrome headless puro não encerra sozinho depois de imprimir)
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-first-run', '--hide-scrollbars'],
});
try {
  const page = await browser.newPage();
  // 100 × 150 mm = 378 × 567 px CSS; fator 3.125 → 1181 × 1772 px (300 dpi)
  await page.setViewport({ width: 378, height: 567, deviceScaleFactor: 3.125 });
  await page.goto(`file://${tmp}`, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(saida, 'etiqueta.pdf'), width: '100mm', height: '150mm', printBackground: true, pageRanges: '1' });
  await page.screenshot({ path: path.join(saida, 'etiqueta.png') });
} finally {
  await browser.close();
}

console.log(`QR → ${url}\n${saida}/ qr-code.svg · qr-code.png · etiqueta.pdf · etiqueta.png`);
