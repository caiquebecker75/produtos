// decodifica o que está impresso nos QR das etiquetas (PNG) de cada página
import jsQR from 'jsqr';
import sharp from 'sharp';
import { readdirSync, existsSync } from 'node:fs';
const pastas = process.argv.slice(2);
for (const p of pastas) {
  const dir = `../${p}/qr`;
  if (!existsSync(dir)) { console.log(p, '— sem pasta qr'); continue; }
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.png'))) {
    const { data, info } = await sharp(`${dir}/${f}`).flatten({ background: '#fff' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const r = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    console.log(`${p}/${f}`.padEnd(58), r ? r.data : 'NÃO LEU');
  }
}
