// Marcador de cada página no mapa do painel: cor + sigla (e formato, se passar de 12 páginas).
// Cor e sigla ficam gravadas em projetos.json ("cor", "sigla") para nunca mudarem quando entra página nova.
export const PALETA = [
  '#C0EE4E', '#00837D', '#FF7A1A', '#2F6BFF', '#D6336C', '#7A4DFF',
  '#FFC400', '#E03131', '#1CB5C9', '#8D5A2B', '#0E1110', '#F783AC',
];
const FORMATOS = ['gota', 'quadrado'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function hashNum(s) {
  let h = 0;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

// texto escuro em cor clara, branco em cor escura
function corTexto(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? '#0E1110' : '#FFFFFF';
}

export function siglaDe(nome) {
  const ignorar = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'display', 'expositor', 'pagina', 'página']);
  const palavras = String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^A-Za-z0-9]+/).filter(Boolean);
  const uteis = palavras.filter((p) => !ignorar.has(p.toLowerCase()));
  const base = uteis.length ? uteis : palavras;
  const sigla = base.length >= 2 ? base[0][0] + base[1][0] : (base[0] || '?').slice(0, 2);
  return sigla.toUpperCase();
}

// catalogo = conteúdo de projetos.json
export function estiloProjeto(slug, catalogo = []) {
  const i = catalogo.findIndex((p) => p.slug === slug);
  const p = catalogo[i];
  const pos = i >= 0 ? i : hashNum(slug);
  const cor = p?.cor || PALETA[pos % PALETA.length];
  return {
    cor,
    texto: corTexto(cor),
    sigla: (p?.sigla || siglaDe(p?.nome || slug)).slice(0, 3).toUpperCase(),
    formato: p?.formato || FORMATOS[Math.floor(pos / PALETA.length) % FORMATOS.length],
  };
}

export function htmlMarcador(e, tamanho = 34) {
  return `<span class="mk mk-${e.formato}" style="--c:${esc(e.cor)};--t:${esc(e.texto)};--s:${tamanho}px"><b>${esc(e.sigla)}</b></span>`;
}
