import sharp from 'sharp';
const k = 4098/889, src = '../.work/canva.png';
const boxes = { logo75:[40,30,125,95], savencia:[45,175,335,270], video:[50,500,331,1000], render_navy:[730,555,830,960], desenho:[35,1095,255,1435], render_azul:[410,1035,505,1470] };
for (const [n,[x0,y0,x1,y1]] of Object.entries(boxes)) {
  await sharp(src).extract({left:Math.round(x0*k),top:Math.round(y0*k),width:Math.round((x1-x0)*k),height:Math.round((y1-y0)*k)}).png().toFile(`../.work/${n}.png`);
  console.log(n);
}
