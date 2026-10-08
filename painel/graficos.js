// Gráficos do painel, em SVG puro: nada de biblioteca, nada de degradê.
// A identidade é a mesma do painel: Anton nos números, lime no dado, papel no fundo.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Number(n || 0).toLocaleString('pt-BR');
export const CORES = ['#A6D934', '#0E1110', '#54594E', '#F59F00', '#3BB54A', '#9AA08F', '#B3261E', '#C0EE4E'];

/* ---------------------------------------------------------------- área + acumulado
   Barras do dia e a curva de lojas acumuladas por cima: dá para ver o ritmo e o avanço. */
export function areaRitmo(dias, { altura = 180 } = {}) {
  if (!dias.length) return '<p class="dica">Sem registros no período.</p>';
  const W = 1000, H = altura, pl = 4, pr = 4, pt = 10, pb = 4;
  const util = H - pb - pt;
  const maxR = Math.max(1, ...dias.map((d) => d.registros));
  const acumulado = [];
  let soma = 0;
  for (const d of dias) { soma += d.novas || 0; acumulado.push(soma); }
  const maxA = Math.max(1, soma);
  const larg = (W - pl - pr) / dias.length;
  const x = (i) => pl + i * larg;
  const yA = (v) => pt + util - (v / maxA) * util;
  const dataCurta = (t) => new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const barras = dias.map((d, i) => {
    const h = d.registros ? Math.max(2, (d.registros / maxR) * util * 0.92) : 0;
    return `<rect x="${(x(i) + larg * 0.16).toFixed(1)}" y="${(pt + util - h).toFixed(1)}" width="${(larg * 0.68).toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${d.registros ? '#C0EE4E' : '#E3E7DA'}"><title>${dataCurta(d.dia)}: ${num(d.registros)} registro(s), ${num(d.pdvs)} loja(s)</title></rect>`;
  }).join('');

  const pontos = acumulado.map((v, i) => `${(x(i) + larg / 2).toFixed(1)},${yA(v).toFixed(1)}`).join(' ');
  const area = `M ${pl},${pt + util} L ${pontos.split(' ').join(' L ')} L ${W - pr},${pt + util} Z`;

  // os rótulos de data ficam em HTML: dentro de um SVG esticado a fonte sairia deformada
  const regua = dias.map((d, i) => ({ d, i })).filter(({ i }) => i % 6 === 0 || i === dias.length - 1)
    .map(({ d }) => `<span>${dataCurta(d.dia)}</span>`).join('');

  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="g-ritmo" role="img" aria-label="Ritmo diário de registros e lojas acumuladas">
    <line x1="${pl}" y1="${pt + util}" x2="${W - pr}" y2="${pt + util}" stroke="#E3E7DA" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
    ${barras}
    <path d="${area}" fill="#0E1110" opacity=".06"/>
    <polyline points="${pontos}" fill="none" stroke="#0E1110" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
  </svg>
  <div class="g-regua">${regua}</div>`;
}

/* ------------------------------------------------------------------------- rosca */
export function donut(partes, { centro, rotulo } = {}) {
  const total = partes.reduce((a, p) => a + p.valor, 0);
  if (!total) return '<p class="dica">Sem dados.</p>';
  const R = 70, r = 44, C = 90;
  let ang = -Math.PI / 2;
  const fatias = partes.map((p, i) => {
    const frac = p.valor / total;
    const fim = ang + frac * Math.PI * 2;
    const ponto = (a, raio) => `${(C + Math.cos(a) * raio).toFixed(2)},${(C + Math.sin(a) * raio).toFixed(2)}`;
    const grande = frac > 0.5 ? 1 : 0;
    const d = `M ${ponto(ang, R)} A ${R} ${R} 0 ${grande} 1 ${ponto(fim, R)} L ${ponto(fim, r)} A ${r} ${r} 0 ${grande} 0 ${ponto(ang, r)} Z`;
    ang = fim;
    return `<path d="${d}" fill="${p.cor || CORES[i % CORES.length]}"><title>${esc(p.nome)}: ${num(p.valor)} (${Math.round(frac * 100)}%)</title></path>`;
  }).join('');
  return `<div class="g-donut">
    <svg viewBox="0 0 180 180" role="img" aria-label="${esc(rotulo || 'Distribuição')}">${fatias}
      <text x="90" y="88" text-anchor="middle" class="g-donut-n">${esc(centro ?? num(total))}</text>
      <text x="90" y="106" text-anchor="middle" class="g-donut-r">${esc(rotulo || '')}</text>
    </svg>
    <ul class="g-legenda">${partes.map((p, i) => `<li><i style="background:${p.cor || CORES[i % CORES.length]}"></i>
      <span>${esc(p.nome)}</span><b>${num(p.valor)}</b><em>${Math.round((p.valor / total) * 100)}%</em></li>`).join('')}</ul>
  </div>`;
}

/* ------------------------------------------------------------- barras horizontais */
export function barras(linhas, { max, sufixo = '' } = {}) {
  if (!linhas.length) return '<p class="dica">Sem dados no filtro.</p>';
  const topo = max ?? Math.max(1, ...linhas.map((l) => l.valor));
  return `<ul class="g-barras">${linhas.map((l, i) => `<li>
    <span class="gb-rot" title="${esc(l.nome)}">${esc(l.nome)}</span>
    <span class="gb-trilho"><i style="width:${Math.max(2, (l.valor / topo) * 100)}%;background:${l.cor || (i === 0 ? '#0E1110' : '#A6D934')}"></i></span>
    <b>${num(l.valor)}${esc(sufixo)}</b>
    ${l.nota ? `<em>${esc(l.nota)}</em>` : ''}
  </li>`).join('')}</ul>`;
}

/* --------------------------------------------------------------------------- funil */
export function funil(etapas) {
  const topo = Math.max(1, ...etapas.map((e) => e.valor));
  return `<ul class="g-funil">${etapas.map((e, i) => {
    const larg = Math.max(12, (e.valor / topo) * 100);
    const antes = i ? etapas[i - 1].valor : null;
    const conv = antes ? Math.round((e.valor / antes) * 100) : null;
    return `<li>
      <div class="gf-top"><span>${esc(e.nome)}</span>${conv != null ? `<em>${conv}% do passo anterior</em>` : ''}</div>
      <div class="gf-barra" style="width:${larg}%;background:${i === 0 ? '#0E1110' : i === etapas.length - 1 ? '#C0EE4E' : '#A6D934'}">
        <b${i === 0 ? ' class="claro"' : ''}>${num(e.valor)}</b>
      </div>
      <small>${esc(e.nota || '')}</small>
    </li>`;
  }).join('')}</ul>`;
}

/* ----------------------------------------------- mapa de calor dia × faixa de hora */
const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export function heatmap(matriz, faixas) {
  const max = Math.max(1, ...matriz.flat());
  return `<div class="g-heat">
    <div class="gh-canto"></div>
    ${faixas.map((f) => `<div class="gh-col">${esc(f)}</div>`).join('')}
    ${matriz.map((linha, d) => `<div class="gh-lin">${DIAS_SEMANA[d]}</div>${linha.map((v, h) => {
      const i = v / max;
      return `<div class="gh-cel" style="background:${v ? `color-mix(in srgb, #A6D934 ${Math.round(18 + i * 82)}%, #F1F2EC)` : '#F1F2EC'}" title="${DIAS_SEMANA[d]}, ${esc(faixas[h])}: ${num(v)} registro(s)">${v ? `<span>${num(v)}</span>` : ''}</div>`;
    }).join('')}`).join('')}
  </div>`;
}

/* ------------------------------------------------------- cruzamento rede × projeto */
export function matriz({ linhas, colunas, valor, rotuloLinha, rotuloColuna }) {
  if (!linhas.length || !colunas.length) return '<p class="dica">Sem cruzamento para mostrar.</p>';
  const max = Math.max(1, ...linhas.flatMap((l) => colunas.map((c) => valor(l, c))));
  return `<div class="tabela-wrap"><table class="g-matriz">
    <thead><tr><th></th>${colunas.map((c) => `<th><span>${esc(rotuloColuna(c))}</span></th>`).join('')}<th class="tot">Total</th></tr></thead>
    <tbody>${linhas.map((l) => {
      const vals = colunas.map((c) => valor(l, c));
      return `<tr><th>${esc(rotuloLinha(l))}</th>${vals.map((v) => `<td style="background:${v ? `color-mix(in srgb, #C0EE4E ${Math.round(22 + (v / max) * 78)}%, #FFFFFF)` : '#FFFFFF'}">${v ? num(v) : '<i>·</i>'}</td>`).join('')}
      <td class="tot">${num(vals.reduce((a, b) => a + b, 0))}</td></tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

/* ------------------------------------------------------------------- big numbers */
export function bigNumbers(itens) {
  return itens.map((i) => `<div class="bn ${i.destaque ? 'destaque' : ''}">
    <small>${esc(i.rotulo)}</small>
    <b>${esc(i.valor)}${i.unidade ? `<u>${esc(i.unidade)}</u>` : ''}</b>
    ${i.variacao != null ? `<span class="bn-var ${i.variacao >= 0 ? 'sobe' : 'cai'}">${i.variacao >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(i.variacao))}% <em>vs. 30 dias antes</em></span>` : ''}
    <em>${esc(i.nota || '')}</em>
  </div>`).join('');
}
