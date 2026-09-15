// Miniatura de compartilhamento (WhatsApp/LinkedIn) de uma página de produto: <pasta>/og.jpg (1200 × 630)
//   node tools/og.mjs <pasta>
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2]?.replace(/\/$/, '');
const html = readFileSync(path.join(raiz, slug, 'index.html'), 'utf8');
const P = JSON.parse(html.match(/<script type="application\/json" id="projeto">([\s\S]*?)<\/script>/)[1]);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const W = 1200, H = 630;
const camadas = [];
const img = P.imagem && !/^https?:/.test(P.imagem) && path.join(raiz, slug, P.imagem);
if (img && existsSync(img)) {
  const peca = await sharp(img).resize({ height: 560, width: 460, fit: 'inside' }).png().toBuffer();
  const m = await sharp(peca).metadata();
  camadas.push({ input: Buffer.from(`<svg width="${W}" height="${H}"><circle cx="930" cy="760" r="400" fill="#C0EE4E"/></svg>`), left: 0, top: 0 });
  camadas.push({ input: peca, left: Math.round(930 - m.width / 2), top: H - m.height - 20 });
}
const logo = await sharp(path.join(raiz, 'assets/img/logo-75lab-preto.png')).resize({ height: 58 }).toBuffer();
camadas.push({ input: logo, left: 72, top: 64 });
camadas.push({
  input: Buffer.from(`<svg width="${W}" height="${H}">
    <style>.a{font-family:'Anton','Impact',sans-serif}.l{font-family:'Lexend','Helvetica Neue',Arial,sans-serif}</style>
    <text x="72" y="250" class="a" font-size="24" letter-spacing="4" fill="#54594E">${esc(String(P.cliente).toUpperCase())}</text>
    <text x="72" y="340" class="l" font-size="82" font-weight="200" fill="#0E1110">${esc(String(P.nome).toUpperCase())}</text>
    <text x="72" y="425" class="l" font-size="82" font-weight="600" fill="#0E1110">${esc(String(P.linha || "").toUpperCase())}</text>
    <rect x="72" y="486" width="370" height="58" rx="29" fill="#0E1110"/>
    <text x="257" y="524" text-anchor="middle" class="a" font-size="22" letter-spacing="3" fill="#C0EE4E">TREINAMENTO DE MONTAGEM</text>
  </svg>`), left: 0, top: 0,
});
await sharp({ create: { width: W, height: H, channels: 3, background: '#F1F2EC' } })
  .composite(camadas).jpeg({ quality: 86 }).toFile(path.join(raiz, slug, 'og.jpg'));
console.log(`${slug}/og.jpg`);
