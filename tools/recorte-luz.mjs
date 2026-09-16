// Tira fundo claro (branco e sombra cinza) por conectividade a partir das bordas, com borda suave.
//   node tools/recorte-luz.mjs entrada.png saida.webp [limite=0.72]
// Diferente do recorte-fundo.mjs (que compara com a cor do canto), aqui o critério é "é claro?",
// então a sombra em degradê sai junto, e a peça escura/colorida segura o preenchimento.
import sharp from 'sharp';
const [,, inp, out, limArg] = process.argv;
const LIM = Number(limArg || 0.72);
const { data, info } = await sharp(inp, { limitInputPixels: false }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const luz = new Float32Array(w * h);
for (let i = 0; i < w * h; i++) {
  luz[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255;
}
const fora = new Uint8Array(w * h);
const pilha = [];
for (let x = 0; x < w; x++) { pilha.push(x, (h - 1) * w + x); }
for (let y = 0; y < h; y++) { pilha.push(y * w, y * w + w - 1); }
while (pilha.length) {
  const i = pilha.pop();
  if (fora[i] || luz[i] < LIM) continue;
  fora[i] = 1;
  const x = i % w, y = (i / w) | 0;
  if (x > 0) pilha.push(i - 1);
  if (x < w - 1) pilha.push(i + 1);
  if (y > 0) pilha.push(i - w);
  if (y < h - 1) pilha.push(i + w);
}
// alfa: fora = 0; perto do limite, transição suave para não serrilhar a borda
for (let i = 0; i < w * h; i++) {
  if (fora[i]) data[i * 4 + 3] = 0;
  else if (luz[i] > LIM - 0.06) data[i * 4 + 3] = Math.round(255 * Math.min(1, (LIM - luz[i] + 0.06) / 0.06));
}
await sharp(data, { raw: { width: w, height: h, channels: 4 } }).trim({ threshold: 1 }).webp({ quality: 88 }).toFile(out);
const m = await sharp(out).metadata();
console.log(`${out} ${m.width}x${m.height}`);
