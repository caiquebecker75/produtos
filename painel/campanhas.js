// Campanhas com QR por vendedor: QR code que leva direto ao WhatsApp de uma pessoa e conta as leituras.
// Vive em outro repositório (caiquebecker75/bv-pesados), então aqui ficam só os atalhos: o painel da
// campanha, a lista de contatos e, por vendedor, o link do QR e o link do painel dele.
const CAMPANHAS = [
  {
    slug: 'bv-pesados',
    nome: 'Empréstimo com Garantia de Veículo · Pesados',
    cliente: 'NEOBAND · BV',
    base: 'https://projetos.75lab.com.br/bv-pesados',
    lista: 'https://projetos.75lab.com.br/bv-pesados/vendedores.json',
  },
];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const IC = {
  abrir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>',
  gente: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20"/><circle cx="9" cy="7.5" r="3.5"/><path d="M22 20v-1.5a4 4 0 0 0-3-3.9"/><path d="M16.5 4.1a4 4 0 0 1 0 7.3"/></svg>',
  copia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>',
  lista: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>',
};

export async function montarCampanhas(toast) {
  const alvo = document.getElementById('lista-campanhas');
  if (!alvo) return;

  const fichas = await Promise.all(CAMPANHAS.map(async (c) => {
    try {
      const d = await fetch(c.lista, { cache: 'no-store' }).then((r) => r.json());
      return { ...c, vendedores: d.vendedores || [] };
    } catch {
      return { ...c, vendedores: [] };   // fora do ar ou aberto de outro endereço: mostra só os atalhos
    }
  }));

  alvo.innerHTML = fichas.map((c) => `
    <li class="pj" data-campanha="${esc(c.slug)}">
      <div class="pj-top">
        <span class="pj-id"><b>${esc(c.nome)}</b><small>${esc(c.cliente)}</small></span>
        <span class="pj-q">${c.vendedores.length}<i>vendedor${c.vendedores.length === 1 ? '' : 'es'}</i></span>
      </div>
      <div class="pj-bts">
        <a class="bt bt-abrir" href="${c.base}/painel/" target="_blank" rel="noopener">${IC.abrir}<span>Painel da campanha</span></a>
        <a class="bt bt-qr" href="${c.base}/leads/" target="_blank" rel="noopener">${IC.gente}<span>Contatos</span></a>
        ${c.vendedores.length ? `<button type="button" class="bt bt-ic" data-ver="${esc(c.slug)}" title="Ver os links de cada vendedor" aria-label="Ver os links de cada vendedor">${IC.lista}</button>` : ''}
      </div>
      <ul class="vendedores" id="vend-${esc(c.slug)}" hidden>
        ${c.vendedores.map((v) => `<li>
          <span>${esc(v.nome)}</span>
          <a class="bt bt-ic" href="${c.base}/${v.codigo}/" target="_blank" rel="noopener" title="Abrir o QR de ${esc(v.nome)}">${IC.abrir}</a>
          <a class="bt bt-ic" href="${c.base}/painel/?v=${v.codigo}" target="_blank" rel="noopener" title="Painel de ${esc(v.nome)}">${IC.gente}</a>
          <button type="button" class="bt bt-ic" data-copiar="${c.base}/painel/?v=${v.codigo}" title="Copiar o link do painel dele">${IC.copia}</button>
        </li>`).join('')}
      </ul>
    </li>`).join('');

  alvo.addEventListener('click', async (e) => {
    const ver = e.target.closest('[data-ver]');
    if (ver) {
      const ul = document.getElementById(`vend-${ver.dataset.ver}`);
      ul.hidden = !ul.hidden;
      ver.classList.toggle('on', !ul.hidden);
      return;
    }
    const cop = e.target.closest('[data-copiar]');
    if (cop) {
      try { await navigator.clipboard.writeText(cop.dataset.copiar); toast?.('Link do painel copiado.'); }
      catch { toast?.('Não deu para copiar aqui. Abra o painel e copie da barra de endereço.'); }
    }
  });
}
