// Inteligência de PDV no painel: as mesmas leituras da Códice, feitas aqui em cima dos registros do QR.
//
// O que dá para medir só com o registro do QR: ponto de venda (agrupado pelo GPS), penetração por rede,
// cidade e estado, peças executadas, ritmo, promotor próprio contra compartilhado, tempo de positivação
// (contado do primeiro registro do projeto) e foto da fachada. Transporte, armazenagem e inventário
// dependem das tags e dos movimentos, que vivem na Códice.
//
// Cidade e estado não vêm no registro: a primeira vez que o painel vê um ponto, ele pergunta ao
// Nominatim (OpenStreetMap) e grava de volta no documento, então o custo é pago uma vez só.

import * as G from './graficos.js?v=1';

const RAIO_PDV_M = 150;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Number(n || 0).toLocaleString('pt-BR');
const pct = (v) => (v == null ? '–' : `${Math.round(v)}%`);
const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function metros(lat1, lng1, lat2, lng2) {
  const R = 6371000, r = (g) => (g * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const BANDEIRAS = ['Assaí', 'Atacadão', 'Carrefour', 'Pão de Açúcar', 'Extra', 'Dia', "Sam's Club", 'Makro', 'Tenda Atacado',
  'Roldão', 'Spani', 'Mart Minas', 'BH Supermercados', 'Savegnago', 'Condor', 'Muffato', 'Zaffari', 'Angeloni',
  'GBarbosa', 'Mateus', 'Hirota', 'St Marche', 'Oba Hortifruti', 'Petz', 'Cobasi', 'Petlove', 'Casas Bahia',
  'Magazine Luiza', 'Fast Shop', 'Leroy Merlin', 'Drogasil', 'Droga Raia', 'Pague Menos'];
const APELIDOS = { crf: 'Carrefour', gpa: 'Pão de Açúcar', pda: 'Pão de Açúcar', atacadao: 'Atacadão', assai: 'Assaí', cenu: 'CENU' };

/** Distância de edição, para juntar o que o promotor digitou errado ("Carreforu" é Carrefour). */
function perto(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  let linha = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const nova = [i];
    for (let j = 1; j <= b.length; j++) {
      nova[j] = Math.min(linha[j] + 1, nova[j - 1] + 1, linha[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    linha = nova;
  }
  return linha[b.length];
}

const capitalizar = (s) => String(s).replace(/\S+/g, (p) => (p.length <= 2 ? p.toLowerCase() : p[0].toUpperCase() + p.slice(1).toLowerCase()));

/** Texto livre vira rede conhecida: apelido, nome inteiro, começo do nome ou erro de digitação. */
function redeConhecida(texto) {
  const t = normalizar(texto);
  if (!t) return null;
  const primeira = t.split(' ')[0];
  if (APELIDOS[t] || APELIDOS[primeira]) return APELIDOS[t] || APELIDOS[primeira];
  for (const b of BANDEIRAS) {
    const nb = normalizar(b);
    if (!nb) continue;
    if (t === nb || t.startsWith(`${nb} `) || (primeira.length >= 3 && nb.startsWith(primeira))) return b;
  }
  for (const b of BANDEIRAS) {
    if (perto(primeira, normalizar(b).split(' ')[0]) <= 2 && primeira.length >= 4) return b;
  }
  return null;
}

export function bandeiraDe(r) {
  const digitada = r.bandeira?.trim();
  if (digitada) return redeConhecida(digitada) || capitalizar(digitada);
  return redeConhecida(r.loja) || 'Não informada';
}

/** Agrupa registros em pontos de venda: até 150 m é a mesma loja; sem GPS, agrupa pelo nome. */
export function agruparPontos(registros) {
  const pontos = [];
  const pontoDe = new Map();
  for (const r of [...registros].sort((a, b) => (a.data?.getTime() || 0) - (b.data?.getTime() || 0))) {
    let alvo = null;
    if (r.geo) {
      let melhor = Infinity;
      for (const p of pontos) {
        if (!p.geo) continue;
        const m = metros(r.geo.lat, r.geo.lng, p.geo.lat, p.geo.lng);
        if (m <= RAIO_PDV_M && m < melhor) { melhor = m; alvo = p; }
      }
    } else {
      alvo = pontos.find((p) => normalizar(p.nome) === normalizar(r.loja)) || null;
    }
    if (!alvo) {
      alvo = { id: `pdv${pontos.length + 1}`, nome: r.loja, geo: r.geo || null, registros: [], nomes: new Map(), bandeira: bandeiraDe(r) };
      pontos.push(alvo);
    }
    alvo.registros.push(r);
    alvo.nomes.set(r.loja, (alvo.nomes.get(r.loja) || 0) + 1);
    if (r.bandeira) alvo.bandeira = bandeiraDe(r);
    if (r.cidade) { alvo.cidade = r.cidade; alvo.uf = r.uf; }
    pontoDe.set(r.id, alvo.id);
  }
  pontos.forEach((p) => { p.nome = [...p.nomes.entries()].sort((a, b) => b[1] - a[1])[0][0]; });
  return { pontos, pontoDe };
}

/** Números da seção, em cima da lista já filtrada. `todos` serve para achar o início de cada projeto. */
export function calcular(lista, todos) {
  const { pontos, pontoDe } = agruparPontos(lista);
  const agora = Date.now();
  const semana = agora - 7 * 864e5;

  const inicioProjeto = new Map();
  for (const r of todos) {
    const t = r.data?.getTime();
    if (!t) continue;
    if (!inicioProjeto.has(r.projeto) || t < inicioProjeto.get(r.projeto)) inicioProjeto.set(r.projeto, t);
  }

  const pecas = new Set();
  for (const r of lista) for (const p of (r.pecas || [])) pecas.add(`${pontoDe.get(r.id)}|${r.projeto}|${p}`);

  const dias = [];
  for (const p of pontos) {
    const primeiro = p.registros[0];
    const ini = inicioProjeto.get(primeiro.projeto);
    if (ini && primeiro.data) dias.push(Math.max(0, (primeiro.data.getTime() - ini) / 864e5));
  }

  const comFoto = lista.filter((r) => r.temFoto || r.fotoUrl).length;
  const tipo = (r) => r.tipoPromotor || 'sem';

  const porTipo = ['proprio', 'compartilhado', 'sem'].map((t) => {
    const g = lista.filter((r) => tipo(r) === t);
    const pdvs = new Set(g.map((r) => pontoDe.get(r.id)));
    const promotores = new Set(g.map((r) => r.telefone));
    const diasAtivos = new Set(g.map((r) => r.data?.toDateString()).filter(Boolean));
    const pc = new Set();
    for (const r of g) for (const p of (r.pecas || [])) pc.add(`${pontoDe.get(r.id)}|${r.projeto}|${p}`);
    return {
      tipo: t, registros: g.length, pdvs: pdvs.size, promotores: promotores.size, pecas: pc.size,
      porDia: diasAtivos.size ? pdvs.size / diasAtivos.size : null,
      comFoto: g.length ? (g.filter((r) => r.temFoto || r.fotoUrl).length / g.length) * 100 : null,
    };
  }).filter((x) => x.registros);

  // primeira visita de cada loja: serve para o acumulado do ritmo e para o risco de perda
  const primeiraDoPonto = new Map(pontos.map((p) => [p.id, p.registros[0]?.data?.getTime() || 0]));
  const ultimaDoPonto = new Map(pontos.map((p) => [p.id, Math.max(...p.registros.map((x) => x.data?.getTime() || 0))]));

  const ritmo = Array.from({ length: 30 }, (_, k) => {
    const d0 = new Date(); d0.setHours(0, 0, 0, 0);
    const ini = d0.getTime() - (29 - k) * 864e5;
    const doDia = lista.filter((r) => r.data && r.data.getTime() >= ini && r.data.getTime() < ini + 864e5);
    const novas = [...primeiraDoPonto.values()].filter((t) => t >= ini && t < ini + 864e5).length;
    return { dia: ini, registros: doDia.length, pdvs: new Set(doDia.map((r) => pontoDe.get(r.id))).size, novas };
  });

  // 30 dias contra os 30 anteriores
  const janela = (de, ate) => {
    const g = lista.filter((r) => r.data && r.data.getTime() >= de && r.data.getTime() < ate);
    const pc = new Set();
    for (const r of g) for (const x of (r.pecas || [])) pc.add(`${pontoDe.get(r.id)}|${r.projeto}|${x}`);
    return { registros: g.length, pdvs: new Set(g.map((r) => pontoDe.get(r.id))).size, pecas: pc.size,
             promotores: new Set(g.map((r) => r.telefone)).size };
  };
  const agora30 = janela(agora - 30 * 864e5, agora + 864e5);
  const antes30 = janela(agora - 60 * 864e5, agora - 30 * 864e5);
  const varia = (a, b) => (b ? ((a - b) / b) * 100 : a ? 100 : null);
  const variacao = {
    registros: varia(agora30.registros, antes30.registros),
    pdvs: varia(agora30.pdvs, antes30.pdvs),
    pecas: varia(agora30.pecas, antes30.pecas),
    promotores: varia(agora30.promotores, antes30.promotores),
  };

  // quando o campo acontece: dia da semana contra faixa de horário
  const FAIXAS = ['6h', '9h', '12h', '15h', '18h', '21h'];
  const heat = Array.from({ length: 7 }, () => Array(FAIXAS.length).fill(0));
  for (const r of lista) {
    if (!r.data) continue;
    const h = Math.min(FAIXAS.length - 1, Math.max(0, Math.floor((r.data.getHours() - 6) / 3)));
    heat[r.data.getDay()][h]++;
  }

  // lojas paradas: material no ponto sem nenhuma visita nova (prevenção de perda)
  const paradas = pontos.filter((p) => agora - (ultimaDoPonto.get(p.id) || 0) > 30 * 864e5);

  const pecasPorPonto = new Map();
  for (const r of lista) {
    const k = pontoDe.get(r.id);
    if (!pecasPorPonto.has(k)) pecasPorPonto.set(k, new Set());
    for (const x of (r.pecas || [])) pecasPorPonto.get(k).add(`${r.projeto}|${x}`);
  }

  const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
  return {
    pontos, pontoDe,
    resumo: {
      registros: lista.length,
      pdvs: pontos.length,
      promotores: new Set(lista.map((r) => r.telefone)).size,
      promotoresSemana: new Set(lista.filter((r) => r.data && r.data.getTime() >= semana).map((r) => r.telefone)).size,
      pecas: pecas.size,
      bandeiras: new Set(pontos.map((p) => p.bandeira)).size,
      comFoto: lista.length ? (comFoto / lista.length) * 100 : null,
      diasPositivacao: media(dias),
      semGeo: lista.filter((r) => !r.geo).length,
      semCidade: lista.filter((r) => r.geo && !r.cidade).length,
    },
    porTipo, ritmo, variacao, heat, faixas: FAIXAS, paradas,
    janela30: agora30, janela60: antes30,
    pecasPorPonto, ultimaDoPonto, primeiraDoPonto,
  };
}

/* ------------------------------------------------------------------ insights */

/** Frases curtas tiradas dos próprios números: o que um gerente leria primeiro. */
export function insights(r, lista, nomeProjeto) {
  const s = r.resumo;
  const fora = [];
  const linhas = recorte(lista, r.pontoDe, r.pontos, 'bandeira', nomeProjeto);
  const topo = linhas[0];
  if (topo && s.pdvs) {
    fora.push({ n: `${Math.round((topo.pdvs / s.pdvs) * 100)}%`, t: `das lojas positivadas são ${topo.chave}`,
      sub: `${num(topo.pdvs)} de ${num(s.pdvs)} lojas · ${num(topo.pecas)} peças` });
  }
  const proprio = r.porTipo.find((t) => t.tipo === 'proprio');
  const comp = r.porTipo.find((t) => t.tipo === 'compartilhado');
  if (proprio && comp && proprio.porDia && comp.porDia) {
    const vezes = proprio.porDia / comp.porDia;
    fora.push({ n: `${vezes.toFixed(1)}×`, t: vezes >= 1 ? 'o promotor próprio positiva mais lojas por dia' : 'o promotor compartilhado positiva mais lojas por dia',
      sub: `${proprio.porDia.toFixed(1)} contra ${comp.porDia.toFixed(1)} loja por dia de campo` });
  }
  if (s.pdvs) {
    const porLoja = s.pecas / s.pdvs;
    fora.push({ n: porLoja.toFixed(1), t: 'peças por loja, na média', sub: `${num(s.pecas)} peças em ${num(s.pdvs)} lojas` });
  }
  const pico = r.heat.flatMap((linha, d) => linha.map((v, h) => ({ v, d, h }))).sort((a, b) => b.v - a.v)[0];
  if (pico && pico.v) {
    const dias = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
    fora.push({ n: r.faixas[pico.h], t: `é o horário de pico, na ${dias[pico.d]}`, sub: `${num(pico.v)} registros nessa janela` });
  }
  if (r.paradas.length) {
    fora.push({ n: num(r.paradas.length), t: 'lojas sem visita há mais de 30 dias', sub: 'material no ponto sem conferência: risco de perda', alerta: true });
  }
  if (s.diasPositivacao != null) {
    fora.push({ n: `${s.diasPositivacao.toFixed(1)} d`, t: 'do começo do projeto até a loja estar positivada', sub: 'média de todas as lojas do filtro' });
  }
  if (s.comFoto != null && s.comFoto < 100) {
    fora.push({ n: pct(s.comFoto), t: 'dos registros têm foto da fachada', sub: s.comFoto < 60 ? 'cobrar a foto fecha a auditoria do PDV' : 'auditoria visual quase completa' });
  }
  return fora.slice(0, 6);
}

/** Linhas do recorte escolhido (bandeira, cidade, estado, projeto ou promotor). */
export function recorte(lista, pontoDe, pontos, qual, nomeProjeto) {
  const pontoPorId = new Map(pontos.map((p) => [p.id, p]));
  const chave = (r) => {
    const p = pontoPorId.get(pontoDe.get(r.id));
    if (qual === 'bandeira') return p?.bandeira || bandeiraDe(r);
    if (qual === 'cidade') return r.cidade ? `${r.cidade}/${r.uf || ''}`.replace(/\/$/, '') : 'Sem cidade';
    if (qual === 'uf') return r.uf || 'Sem estado';
    if (qual === 'promotor') return `${r.nome}|${r.telefone}`;
    return r.projeto;
  };
  const m = new Map();
  for (const r of lista) {
    const k = chave(r) || 'Não informado';
    if (!m.has(k)) m.set(k, { chave: k, registros: 0, pdvs: new Set(), pecas: new Set(), comFoto: 0, ultimo: 0, tipos: new Set() });
    const x = m.get(k);
    x.registros++;
    x.pdvs.add(pontoDe.get(r.id));
    for (const p of (r.pecas || [])) x.pecas.add(`${pontoDe.get(r.id)}|${r.projeto}|${p}`);
    if (r.temFoto || r.fotoUrl) x.comFoto++;
    if (r.data) x.ultimo = Math.max(x.ultimo, r.data.getTime());
    if (r.tipoPromotor) x.tipos.add(r.tipoPromotor);
  }
  return [...m.values()].map((x) => ({
    chave: x.chave,
    rotulo: qual === 'projeto' ? nomeProjeto(x.chave).nome : qual === 'promotor' ? x.chave.split('|')[0] : x.chave,
    extra: qual === 'projeto' ? nomeProjeto(x.chave).cliente : qual === 'promotor' ? [...x.tipos].map((t) => (t === 'proprio' ? 'Próprio' : 'Compartilhado')).join(' · ') : '',
    registros: x.registros, pdvs: x.pdvs.size, pecas: x.pecas.size,
    comFoto: x.registros ? (x.comFoto / x.registros) * 100 : 0, ultimo: x.ultimo,
  })).sort((a, b) => b.pdvs - a.pdvs || b.registros - a.registros);
}

/* ------------------------------------------------------------------ desenho */

const ROTULO_TIPO = { proprio: 'Promotor próprio', compartilhado: 'Promotor compartilhado', sem: 'Sem tipo informado' };
const SUB_TIPO = {
  proprio: 'dedicado à marca',
  compartilhado: 'agência, atende várias marcas',
  sem: 'registros antes da pergunta entrar no QR',
};

export function desenhar({ lista, todos, qual, nomeProjeto, dataFmt }) {
  const r = calcular(lista, todos);
  const s = r.resumo;
  const el = (id) => document.querySelector(id);
  const pintar = (id, html) => { const n = el(id); if (n) n.innerHTML = html; };

  /* ---- big numbers */
  pintar('#intel-bn', G.bigNumbers([
    { rotulo: 'Lojas positivadas', valor: num(s.pdvs), destaque: true, variacao: r.variacao.pdvs,
      nota: `${num(s.bandeiras)} redes · ${num(s.registros)} registros` },
    { rotulo: 'Peças executadas', valor: num(s.pecas), variacao: r.variacao.pecas,
      nota: s.pdvs ? `${(s.pecas / s.pdvs).toFixed(1)} por loja` : '' },
    { rotulo: 'Promotores em campo', valor: num(s.promotores), variacao: r.variacao.promotores,
      nota: `${num(s.promotoresSemana)} ativos nos últimos 7 dias` },
    { rotulo: 'Tempo de positivação', valor: s.diasPositivacao == null ? '–' : s.diasPositivacao.toFixed(1), unidade: s.diasPositivacao == null ? '' : 'd',
      nota: 'do início do projeto até a loja' },
    { rotulo: 'Auditoria com foto', valor: pct(s.comFoto), nota: s.semGeo ? `${num(s.semGeo)} sem localização` : 'todas com localização' },
  ]));

  /* ---- insights */
  pintar('#intel-insights', insights(r, lista, nomeProjeto).map((i) => `
    <article class="insight ${i.alerta ? 'alerta' : ''}">
      <b>${esc(i.n)}</b><span>${esc(i.t)}</span><small>${esc(i.sub)}</small>
    </article>`).join(''));

  /* ---- ritmo */
  pintar('#intel-ritmo', G.areaRitmo(r.ritmo));
  const novas30 = r.ritmo.reduce((a, d) => a + d.novas, 0);
  pintar('#intel-ritmo-dica', `${num(r.janela30.registros)} registros · ${num(novas30)} lojas novas em 30 dias`);

  /* ---- recorte escolhido: barras + tabela */
  const linhas = recorte(lista, r.pontoDe, r.pontos, qual, nomeProjeto);
  const titulos = { bandeira: 'Rede', cidade: 'Cidade', uf: 'Estado', projeto: 'Projeto', promotor: 'Promotor' };
  pintar('#intel-barras', G.barras(linhas.slice(0, 8).map((l) => ({
    nome: l.rotulo, valor: l.pdvs, nota: `${num(l.pecas)} peças · ${pct(l.comFoto)} com foto`,
  })), { sufixo: '' }));
  const maxPdv = Math.max(1, ...linhas.map((l) => l.pdvs));
  pintar('#intel-tabela', `
    <thead><tr><th>${esc(titulos[qual])}</th><th>Lojas</th><th>Peças</th><th>Registros</th><th>Com foto</th><th>Último</th></tr></thead>
    <tbody>${linhas.map((l) => `<tr>
      <td><b>${esc(l.rotulo)}</b>${l.extra ? `<small>${esc(l.extra)}</small>` : ''}
        <span class="barra-mini"><i style="width:${(l.pdvs / maxPdv) * 100}%"></i></span></td>
      <td class="n"><b>${num(l.pdvs)}</b></td>
      <td class="n">${num(l.pecas)}</td>
      <td class="n">${num(l.registros)}</td>
      <td class="n">${pct(l.comFoto)}</td>
      <td class="n"><small>${l.ultimo ? esc(dataFmt(new Date(l.ultimo))) : ''}</small></td>
    </tr>`).join('') || '<tr><td colspan="6" class="vazio-td">Nenhum registro neste filtro.</td></tr>'}</tbody>`);

  /* ---- próprio contra compartilhado */
  const CORES_TIPO = { proprio: '#0E1110', compartilhado: '#A6D934', sem: '#E3E7DA' };
  pintar('#intel-donut', G.donut(r.porTipo.map((t) => ({ nome: ROTULO_TIPO[t.tipo], valor: t.pdvs, cor: CORES_TIPO[t.tipo] })),
    { centro: num(s.pdvs), rotulo: 'lojas' }));
  pintar('#intel-tipos', r.porTipo.map((t) => `
    <div class="tipo">
      <div class="tipo-top"><b><i style="background:${CORES_TIPO[t.tipo]}"></i>${esc(ROTULO_TIPO[t.tipo])}</b><small>${esc(SUB_TIPO[t.tipo])}</small></div>
      <div class="tipo-nums">
        <span><small>Promotores</small><b>${num(t.promotores)}</b></span>
        <span><small>Lojas</small><b>${num(t.pdvs)}</b></span>
        <span><small>Peças</small><b>${num(t.pecas)}</b></span>
        <span><small>Lojas por dia</small><b>${t.porDia == null ? '–' : t.porDia.toFixed(1)}</b></span>
        <span><small>Com foto</small><b>${pct(t.comFoto)}</b></span>
      </div>
    </div>`).join('') || '<p class="dica">Sem registros no filtro.</p>');

  /* ---- funil da execução */
  const comGeo = lista.filter((x) => x.geo).length;
  const comFotoN = lista.filter((x) => x.temFoto || x.fotoUrl).length;
  pintar('#intel-funil', G.funil([
    { nome: 'Registros no QR', valor: s.registros, nota: 'cada leitura de peça no ponto' },
    { nome: 'Com localização', valor: comGeo, nota: 'GPS do celular no momento da leitura' },
    { nome: 'Lojas positivadas', valor: s.pdvs, nota: 'pontos de venda distintos, agrupados por GPS' },
    { nome: 'Com foto da fachada', valor: comFotoN, nota: 'prova visual para auditoria' },
  ]));

  /* ---- quando o campo acontece */
  pintar('#intel-heat', G.heatmap(r.heat, r.faixas));

  /* ---- cruzamento rede × projeto */
  const pontoPorId = new Map(r.pontos.map((p) => [p.id, p]));
  const cruz = new Map();
  for (const x of lista) {
    const p = pontoPorId.get(r.pontoDe.get(x.id));
    if (!p) continue;
    const k = `${p.bandeira}|${x.projeto}`;
    if (!cruz.has(k)) cruz.set(k, new Set());
    cruz.get(k).add(p.id);
  }
  const porRede = new Map();
  for (const p of r.pontos) porRede.set(p.bandeira, (porRede.get(p.bandeira) || 0) + 1);
  const redes = [...porRede.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k);
  const projetos = [...new Set(lista.map((x) => x.projeto))]
    .sort((a, b) => lista.filter((x) => x.projeto === b).length - lista.filter((x) => x.projeto === a).length).slice(0, 7);
  pintar('#intel-matriz', G.matriz({
    linhas: redes, colunas: projetos,
    valor: (rede, proj) => cruz.get(`${rede}|${proj}`)?.size || 0,
    rotuloLinha: (rede) => rede,
    rotuloColuna: (proj) => nomeProjeto(proj).nome,
  }));

  el('#intel-dica').textContent =
    `${num(s.pdvs)} loja${s.pdvs === 1 ? '' : 's'} · ${num(s.pecas)} peça${s.pecas === 1 ? '' : 's'} executada${s.pecas === 1 ? '' : 's'}`;
  return r;
}
/* --------------------------------------------------- cidade e estado pelo GPS */

const cacheGeo = new Map();
let rodando = false;

export async function completarCidades({ registros, F, db, aoAtualizar, limite = 120 }) {
  if (rodando) return;
  const faltam = registros.filter((r) => r.geo && !r.cidade).slice(0, limite);
  const alvo = document.querySelector('#intel-geo');
  if (!faltam.length) { if (alvo) alvo.textContent = ''; return; }
  rodando = true;
  let feitos = 0;
  for (const r of faltam) {
    if (alvo) alvo.textContent = `completando cidade e estado… ${feitos}/${faltam.length}`;
    const chave = `${r.geo.lat.toFixed(3)},${r.geo.lng.toFixed(3)}`;
    try {
      let lugar = cacheGeo.get(chave);
      if (!lugar) {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${r.geo.lat}&lon=${r.geo.lng}`;
        const j = await (await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } })).json();
        const a = j.address || {};
        const iso = a['ISO3166-2-lvl4'] || '';
        lugar = {
          cidade: a.city || a.town || a.village || a.municipality || a.city_district || null,
          bairro: a.suburb || a.neighbourhood || a.quarter || null,
          uf: iso.startsWith('BR-') ? iso.slice(3) : null,
        };
        cacheGeo.set(chave, lugar);
        await new Promise((ok) => setTimeout(ok, 1200)); // a política do Nominatim é 1 por segundo
      }
      if (lugar.cidade) {
        await F.updateDoc(F.doc(db, 'instalacoes', r.id), { cidade: lugar.cidade, uf: lugar.uf, bairro: lugar.bairro });
        Object.assign(r, lugar);
        feitos++;
        if (feitos % 5 === 0) aoAtualizar?.();
      }
    } catch (e) {
      console.warn('geocodificação', e);
    }
  }
  rodando = false;
  if (alvo) alvo.textContent = feitos ? `cidade e estado completados em ${feitos} registro(s)` : '';
  aoAtualizar?.();
}

/* ------------------------------------------------------------ fachadas */

const cacheFoto = new Map();

export async function desenharFachadas({ lista, F, db, dataFmt, nomeProjeto, limite = 24 }) {
  const grade = document.querySelector('#intel-fachadas');
  const dica = document.querySelector('#intel-fachadas-dica');
  const comFoto = lista.filter((r) => r.temFoto).sort((a, b) => (b.data?.getTime() || 0) - (a.data?.getTime() || 0));
  dica.textContent = comFoto.length ? `${comFoto.length} registro(s) com foto · mostrando os ${Math.min(limite, comFoto.length)} mais recentes` : '';
  if (!comFoto.length) {
    grade.innerHTML = '<p class="dica">Nenhuma foto ainda. O QR passou a pedir a foto da fachada em 16/09: os registros anteriores não têm.</p>';
    return;
  }
  grade.innerHTML = comFoto.slice(0, limite).map((r) => `
    <figure class="fachada" data-foto="${esc(r.id)}" title="${esc(r.loja)} · ${esc(bandeiraDe(r))}${r.cidade ? ` · ${esc(r.cidade)}/${esc(r.uf || '')}` : ''} · ${esc(r.nome)} · ${esc(r.data ? dataFmt(r.data) : '')}">
      <div class="fachada-img"><span class="carregando-foto"></span></div>
      <figcaption><b>${esc(r.loja)}</b><small>${esc(bandeiraDe(r))}${r.cidade ? ` · ${esc(r.cidade)}/${esc(r.uf || '')}` : ''}</small>
        <small>${esc(nomeProjeto(r.projeto).nome)}</small>
        <small>${esc(r.nome)} · ${esc(r.data ? dataFmt(r.data) : '')}</small></figcaption>
    </figure>`).join('');
  for (const r of comFoto.slice(0, limite)) {
    const caixa = grade.querySelector(`[data-foto="${CSS.escape(r.id)}"] .fachada-img`);
    if (!caixa) continue;
    try {
      let img = cacheFoto.get(r.id);
      if (img === undefined) {
        const snap = await F.getDoc(F.doc(db, 'fotos', r.id));
        img = snap.exists() ? snap.data().img : null;
        cacheFoto.set(r.id, img);
      }
      caixa.innerHTML = img
        ? `<a href="${img}" target="_blank" rel="noopener"><img src="${img}" alt="Fachada de ${esc(r.loja)}" loading="lazy"></a>`
        : '<span class="dica">foto não encontrada</span>';
    } catch {
      caixa.innerHTML = '<span class="dica">sem acesso à foto</span>';
    }
  }
}
