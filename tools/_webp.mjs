// corta o transparente, redimensiona e grava webp
import sharp from 'sharp';
import { basename } from 'node:path';
const [entrada, saida, larguraMax = '1500', q = '88'] = process.argv.slice(2);
const img = sharp(entrada).trim({ threshold: 1 });
const meta = await img.toBuffer({ resolveWithObject: true });
let s = sharp(meta.data);
const info = meta.info;
if (info.width > Number(larguraMax)) s = s.resize({ width: Number(larguraMax) });
await s.webp({ quality: Number(q) }).toFile(saida);
const fim = await sharp(saida).metadata();
console.log(basename(saida), `${fim.width}x${fim.height}`);
