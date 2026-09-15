// Tira o fundo liso de uma imagem (flood fill a partir das bordas) e grava PNG/WebP com transparência.
//   node tools/recorte-fundo.mjs entrada.png saida.webp [tolerancia=38]
import sharp from 'sharp';
const [,, inp, out, tolArg] = process.argv;
const tol = Number(tolArg || 38);
const { data, info } = await sharp(inp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const px = (i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
const bg = px(0);
const near = (i) => { const [r, g, b] = px(i); return Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) <= tol; };
const seen = new Uint8Array(w * h), stack = [];
for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
while (stack.length) {
  const i = stack.pop();
  if (seen[i] || !near(i)) continue;
  seen[i] = 1; data[i * 4 + 3] = 0;
  const x = i % w, y = (i / w) | 0;
  if (x > 0) stack.push(i - 1); if (x < w - 1) stack.push(i + 1);
  if (y > 0) stack.push(i - w); if (y < h - 1) stack.push(i + w);
}
// suaviza a borda: pixel opaco vizinho de transparente fica meio transparente
for (let i = 0; i < w * h; i++) if (!seen[i]) {
  const x = i % w, y = (i / w) | 0;
  if ((x > 0 && seen[i - 1]) || (x < w - 1 && seen[i + 1]) || (y > 0 && seen[i - w]) || (y < h - 1 && seen[i + w])) data[i * 4 + 3] = 150;
}
let img = sharp(data, { raw: info }).trim();
img = out.endsWith('.webp') ? img.webp({ quality: 90, alphaQuality: 90 }) : img.png();
await img.toFile(out);
console.log('ok', out);
