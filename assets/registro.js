// Registro de instalação: obrigatório antes de abrir a página (pelo QR ou pelo link), e de novo pelo botão "Registrar instalação".
// Pede nome, telefone e loja, pega a localização do aparelho e grava em Firestore/instalacoes,
// que só a equipe 75 LAB lê no painel (/painel/). No enxoval, grava também as peças executadas.
import { db } from './base.js?v=1';
import { chaveAcesso, chaveLivre } from './acesso.js?v=4';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ler = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
const CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>';
const PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';

// ---------- localização ----------
const geo = { estado: 'parado', pos: null, espera: [] };
function pedirLocalizacao() {
  if (!('geolocation' in navigator)) { setGeo('indisponivel'); return; }
  if (geo.estado === 'buscando') return;
  setGeo('buscando');
  navigator.geolocation.getCurrentPosition(
    (p) => {
      geo.pos = { lat: p.coords.latitude, lng: p.coords.longitude, precisao: Math.round(p.coords.accuracy) };
      setGeo('ok');
    },
    (e) => setGeo(e.code === 1 ? 'negado' : e.code === 3 ? 'tempo' : 'erro'),
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 },
  );
}
function setGeo(estado) {
  geo.estado = estado;
  if (estado !== 'buscando') { geo.espera.forEach((r) => r()); geo.espera = []; }
  desenharGeo();
}
const aguardarGeo = (ms) => (geo.estado !== 'buscando' ? Promise.resolve()
  : new Promise((r) => { geo.espera.push(r); setTimeout(r, ms); }));

function desenharGeo() {
  const el = $('#reg-geo');
  if (!el) return;
  el.dataset.estado = geo.estado;
  const txt = {
    parado: '<b>Localização obrigatória.</b> Quando o celular perguntar, toque em Permitir.',
    buscando: 'Pegando a localização da loja…',
    ok: `<b>Localização registrada</b>${geo.pos ? ` · precisão de ${geo.pos.precisao} m` : ''}`,
    negado: '<b>Localização bloqueada, e ela é obrigatória.</b> iPhone: toque em <b>aA</b> na barra do Safari › Ajustes do Site › Localização › Permitir. Android: toque no cadeado ao lado do endereço › Permissões › Localização. Depois toque em Tentar de novo.',
    tempo: '<b>Sem sinal de GPS agora.</b> Vá para perto da entrada da loja e tente de novo.',
    erro: '<b>Não deu para pegar a localização.</b> Confira se a localização do celular está ligada e tente de novo.',
    indisponivel: '<b>Este navegador não informa a localização.</b> Abra o link no Safari (iPhone) ou no Chrome (Android).',
  }[geo.estado];
  const tentar = ['negado', 'tempo', 'erro'].includes(geo.estado) ? '<button type="button" id="reg-geo-tentar">Tentar de novo</button>' : '';
  el.innerHTML = `<span class="dot">${PIN}</span><span>${txt}</span>${tentar}`;
  $('#reg-geo-tentar')?.addEventListener('click', pedirLocalizacao);
}

// ---------- foto da fachada ----------
// reduz no próprio celular (lado maior 1080 px, JPEG): cabe num documento do Firestore e sobe rápido com sinal fraco
async function comprimirFoto(arquivo) {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = url; });
    const lado = 1080, esc = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * esc); c.height = Math.round(img.naturalHeight * esc);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.72, 0.6, 0.48, 0.36]) {
      const dado = c.toDataURL('image/jpeg', q);
      if (dado.length < 850000) return dado;
    }
    throw new Error('foto grande demais');
  } finally { URL.revokeObjectURL(url); }
}

const BANDEIRAS = ['Assaí', 'Atacadão', 'Carrefour', 'Carrefour Bairro', 'Pão de Açúcar', 'Extra', 'Dia', 'Sam\'s Club', 'Makro', 'Tenda Atacado', 'Roldão', 'Spani', 'Mart Minas', 'BH Supermercados', 'Savegnago', 'Condor', 'Muffato', 'Zaffari', 'Angeloni', 'GBarbosa', 'Mateus', 'Hirota', 'St Marche', 'Oba Hortifruti', 'Petz', 'Cobasi', 'Petlove', 'Casas Bahia', 'Magazine Luiza', 'Fast Shop', 'Leroy Merlin', 'Drogasil', 'Droga Raia', 'Pague Menos'];

// ---------- telefone ----------
const soDigitos = (s) => s.replace(/\D/g, '').slice(0, 11);
function mascara(d) {
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}


export function iniciarRegistro(P, { toast, ICON, senhaHash, pecas = () => [], nomesPecas = () => [], trocarPecas = null }) {
  const params = new URLSearchParams(location.search);
  const veioDoQR = params.has('qr');
  const chaveReg = `reg75:${P.slug}`;
  const botao = () => $('#btn-reg');

  // botão do topo: "registrada" só se este aparelho já registrou estas mesmas peças nas últimas 12 h
  function atualizarBotao() {
    const b = botao();
    if (!b) return;
    const ultimo = ler(chaveReg);
    const ok = jaRegistrou();
    b.classList.toggle('ok', ok);
    b.querySelector('span').textContent = ok ? 'Instalação registrada' : 'Registrar instalação';
    b.title = ok && ultimo.loja ? `Registrada em ${ultimo.loja}. Toque para registrar outra loja.` : '';
    if (ok) $('.faixa-reg')?.remove();
  }
  atualizarBotao();

  // este aparelho registrou nas últimas 12 h todas as peças que estão abertas agora
  function jaRegistrou() {
    const ultimo = ler(chaveReg);
    return Boolean(ultimo && Date.now() - ultimo.quando < 12 * 3600e3 && pecas().every((id) => (ultimo.pecas || []).includes(id)));
  }

  // antes de abrir a página: nome, telefone, loja e localização são obrigatórios (resolve depois de registrar)
  // quem chega pelo QR SEMPRE preenche (escaneou = está instalando agora, pode ser outra loja);
  // o pulo de 12 h vale só para quem volta pelo link para consultar a montagem
  function exigir() {
    if (!veioDoQR && jaRegistrou()) return Promise.resolve();
    return new Promise((resolve) => abrir({ obrigatorio: true, aoConcluir: resolve }));
  }

  function faixa() {
    if ($('.faixa-reg') || botao()?.classList.contains('ok')) return;
    const f = document.createElement('div');
    f.className = 'faixa-reg';
    f.innerHTML = '<span>Instalação ainda não registrada.</span><button type="button">Registrar</button>';
    f.querySelector('button').addEventListener('click', abrir);
    document.body.appendChild(f);
  }

  // modo.obrigatorio: sem X, fundo da marca, só sai registrando · modo.aoConcluir: chamado ao terminar
  function abrir(modo = {}) {
    if ($('.sheet-bg')) return;
    db(); // já vai baixando o Firebase
    if (geo.estado === 'parado' || geo.estado === 'tempo' || geo.estado === 'erro') pedirLocalizacao();
    const pessoa = ler('reg75:pessoa') || {};
    const nomes = nomesPecas();
    const bg = document.createElement('div');
    bg.className = `sheet-bg${modo.obrigatorio ? ' obrigatorio' : ''}`;
    bg.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="reg-titulo">
        <div class="sheet-top"><span class="tag">Registro de instalação</span>${modo.obrigatorio ? '' : `<button class="fechar" type="button" aria-label="Fechar">${X}</button>`}</div>
        <form id="reg-form" novalidate>
          <h2 id="reg-titulo">Onde ${nomes.length > 1 ? 'as peças' : 'a peça'} <b>${nomes.length > 1 ? 'estão sendo instaladas?' : 'está sendo instalada?'}</b></h2>
          <p class="peca">${esc(P.cliente)} · ${esc(P.nome)} ${esc(P.linha || '')}</p>
          ${modo.obrigatorio ? '<p class="reg-aviso">Antes de ver a montagem, registre <b>quem está instalando</b> e <b>em qual loja</b>.</p>' : ''}
          ${nomes.length ? `<div class="reg-pecas"><span>Peças: <b>${esc(nomes.join(', '))}</b></span>${trocarPecas ? '<button type="button" class="link-btn" data-reg-trocar>Trocar</button>' : ''}</div>` : ''}
          <label class="campo"><span>Seu nome</span><input name="nome" autocomplete="name" required minlength="2" maxlength="80" value="${esc(pessoa.nome || '')}" placeholder="Nome e sobrenome"></label>
          <label class="campo"><span>Telefone (WhatsApp)</span><input name="telefone" type="tel" inputmode="tel" autocomplete="tel-national" required value="${esc(mascara(soDigitos(pessoa.telefone || '')))}" placeholder="(11) 91234-5678"></label>
          <fieldset class="campo escolha"><span>Você é promotor</span>
            <div class="opcoes">
              <label><input type="radio" name="tipoPromotor" value="proprio" ${pessoa.tipoPromotor === 'proprio' ? 'checked' : ''}><span><b>Próprio</b><small>Só desta marca</small></span></label>
              <label><input type="radio" name="tipoPromotor" value="compartilhado" ${pessoa.tipoPromotor === 'compartilhado' ? 'checked' : ''}><span><b>Compartilhado</b><small>Agência, atende várias marcas</small></span></label>
            </div>
          </fieldset>
          <label class="campo"><span>Rede (bandeira)</span><input name="bandeira" list="reg-bandeiras" autocomplete="off" required minlength="2" maxlength="60" placeholder="Ex.: Carrefour"></label>
          <datalist id="reg-bandeiras">${BANDEIRAS.map((b) => `<option value="${esc(b)}">`).join('')}</datalist>
          <label class="campo"><span>Loja (unidade)</span><input name="loja" autocomplete="organization" required minlength="2" maxlength="140" placeholder="Ex.: Carrefour Pinheiros"></label>
          <div class="campo foto-fachada">
            <span>Foto da fachada da loja</span>
            <label class="foto-box" id="reg-foto-box">
              <input type="file" name="foto" accept="image/*" capture="environment">
              <span class="foto-vazio">${CAM}<b>Tirar foto da fachada</b><small>De frente, com o nome da loja aparecendo</small></span>
              <img alt="Foto da fachada" hidden>
            </label>
          </div>
          <div class="geo" id="reg-geo" aria-live="polite"></div>
          <p class="erro-msg" id="reg-erro" hidden></p>
          <button class="enviar" type="submit">Registrar instalação</button>
          <p class="lgpd">Ao registrar, você concorda que a 75 LAB use seu nome, telefone e a localização deste aparelho somente para acompanhar a execução desta peça no ponto de venda.</p>
        </form>
      </div>`;
    document.body.appendChild(bg);
    document.body.style.overflow = 'hidden';
    desenharGeo();

    const form = $('#reg-form', bg);
    const tel = form.telefone;
    tel.addEventListener('input', () => { tel.value = mascara(soDigitos(tel.value)); });
    const fechar = () => {
      bg.remove();
      document.body.style.overflow = '';
      if (veioDoQR) faixa();
    };
    $('.fechar', bg)?.addEventListener('click', fechar); // só fecha no X (clicar fora não perde o que foi digitado)
    $('[data-reg-trocar]', bg)?.addEventListener('click', async () => {
      bg.remove();
      document.body.style.overflow = '';
      await trocarPecas();
      abrir(modo);
    });
    setTimeout(() => (pessoa.nome ? form.bandeira : form.nome).focus({ preventScroll: true }), 350);

    // foto da fachada: comprime assim que tira, mostra a prévia e guarda pronta para o envio
    let foto = null;
    form.foto.addEventListener('change', async () => {
      const arq = form.foto.files?.[0];
      const box = $('#reg-foto-box', bg);
      if (!arq) return;
      box.dataset.estado = 'lendo';
      try {
        foto = await comprimirFoto(arq);
        const img = $('img', box);
        img.src = foto; img.hidden = false;
        box.dataset.estado = 'ok';
      } catch (e) {
        console.error(e);
        foto = null;
        box.dataset.estado = 'erro';
      }
    });

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const erro = $('#reg-erro', bg);
      const nome = form.nome.value.trim().replace(/\s+/g, ' ');
      const telefone = soDigitos(tel.value);
      const loja = form.loja.value.trim().replace(/\s+/g, ' ');
      const bandeira = form.bandeira.value.trim().replace(/\s+/g, ' ');
      const tipoPromotor = form.tipoPromotor.value;
      const invalidos = [];
      form.nome.setAttribute('aria-invalid', String(nome.length < 2)); if (nome.length < 2) invalidos.push('seu nome');
      tel.setAttribute('aria-invalid', String(telefone.length < 10)); if (telefone.length < 10) invalidos.push('o telefone com DDD');
      $('.escolha', form).setAttribute('aria-invalid', String(!tipoPromotor)); if (!tipoPromotor) invalidos.push('se você é promotor próprio ou compartilhado');
      form.bandeira.setAttribute('aria-invalid', String(bandeira.length < 2)); if (bandeira.length < 2) invalidos.push('a rede');
      form.loja.setAttribute('aria-invalid', String(loja.length < 2)); if (loja.length < 2) invalidos.push('a loja');
      $('#reg-foto-box', bg).setAttribute('aria-invalid', String(!foto)); if (!foto) invalidos.push('a foto da fachada');
      if (invalidos.length) {
        erro.textContent = `Preencha ${invalidos.join(', ')}.`;
        erro.hidden = false;
        return;
      }
      erro.hidden = true;
      const enviar = $('.enviar', form);
      enviar.disabled = true;
      // localização obrigatória: sem ela o registro não sai (as regras também recusam)
      if (geo.estado !== 'ok') {
        if (geo.estado !== 'buscando') pedirLocalizacao();
        enviar.textContent = 'Pegando localização…';
        await aguardarGeo(25000);
      }
      if (geo.estado !== 'ok' || !geo.pos) {
        erro.textContent = {
          negado: 'A localização é obrigatória. Libere a localização para este site (veja como logo acima) e toque em Tentar de novo.',
          indisponivel: 'A localização é obrigatória e este navegador não informa. Abra o link no Safari (iPhone) ou no Chrome (Android).',
        }[geo.estado] || 'A localização é obrigatória e ainda não chegou. Vá para perto da entrada da loja e toque em Registrar de novo.';
        erro.hidden = false;
        enviar.disabled = false;
        enviar.textContent = 'Registrar instalação';
        $('#reg-geo', bg)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      enviar.textContent = 'Enviando…';
      gravar('reg75:pessoa', { nome, telefone, tipoPromotor });
      const lista = pecas();
      try {
        const { fs, db: base } = await db();
        const ref = await fs.addDoc(fs.collection(base, 'instalacoes'), {
          projeto: P.slug,
          projetoNome: `${P.nome} ${P.linha || ''}`.trim().slice(0, 140),
          cliente: String(P.cliente || '').slice(0, 100),
          nome,
          telefone,
          loja,
          bandeira,
          tipoPromotor,
          temFoto: true,
          geo: geo.pos,
          geoStatus: geo.estado === 'buscando' ? 'tempo' : geo.estado,
          origem: veioDoQR ? 'qr' : 'link',
          aparelho: navigator.userAgent.slice(0, 200),
          ...(senhaHash ? { senhaHash } : {}), // página com acesso livre não tem senha
          ...(lista.length ? { pecas: lista } : {}),
          criadoEm: fs.serverTimestamp(),
        });
        // foto em documento à parte (fotos/{id da instalação}): a lista do painel continua leve
        enviar.textContent = 'Enviando a foto…';
        for (let t = 0; t < 3; t++) {
          try { await fs.setDoc(fs.doc(base, 'fotos', ref.id), { img: foto, criadoEm: fs.serverTimestamp() }); break; }
          catch (e) { console.error(e); await new Promise((r) => setTimeout(r, 1500 * (t + 1))); }
        }
        gravar(chaveReg, { loja, quando: Date.now(), pecas: lista });
        if (veioDoQR) {
          const u = new URL(location.href);
          u.searchParams.delete('qr');
          history.replaceState(null, '', u.pathname + u.search + u.hash);
        }
        atualizarBotao();
        $('.sheet', bg).innerHTML = `
          <div class="sucesso">
            <div class="ok">${ICON.check}</div>
            <h2>Instalação <b>registrada</b></h2>
            <p>Obrigado, ${esc(nome.split(' ')[0])}. Agora siga o passo a passo de montagem e confira o checklist no final.</p>
            <button class="enviar" type="button">Ver a montagem</button>
          </div>`;
        $('.sucesso .enviar', bg).addEventListener('click', () => {
          bg.remove();
          document.body.style.overflow = '';
          if (modo.aoConcluir) return modo.aoConcluir(); // registro obrigatório: agora a página abre
          document.querySelector('.peca-cap, [id$="montagem"]')?.scrollIntoView();
        });
      } catch (e) {
        console.error(e);
        if (e.code === 'permission-denied') {
          // senha trocada, acesso livre desligado, peça desabilitada ou página tirada do ar no painel depois que este aparelho entrou
          try { localStorage.removeItem(chaveAcesso(P.slug)); localStorage.removeItem(chaveLivre(P.slug)); } catch {}
          erro.textContent = 'Esta página mudou no painel (senha nova, peça desabilitada ou página fora do ar). Recarregando…';
          erro.hidden = false;
          enviar.textContent = 'Aguarde…';
          setTimeout(() => location.reload(), 2600);
          return;
        }
        enviar.disabled = false;
        enviar.textContent = 'Tentar de novo';
        erro.textContent = navigator.onLine
          ? 'Não conseguimos registrar agora. Confira os dados e tente de novo.'
          : 'Sem internet no momento. Tente de novo quando o sinal voltar.';
        erro.hidden = false;
        // loja sem sinal: não trava a montagem; a faixa "Instalação ainda não registrada" fica lembrando
        if (modo.aoConcluir && !$('#reg-depois', bg)) {
          erro.insertAdjacentHTML('afterend', '<button type="button" class="link-btn" id="reg-depois">Ver a montagem e registrar quando o sinal voltar</button>');
          $('#reg-depois', bg).addEventListener('click', () => {
            bg.remove();
            document.body.style.overflow = '';
            modo.aoConcluir();
            faixa();
          });
        }
      }
    });
  }

  document.addEventListener('click', (e) => { if (e.target.closest('#btn-reg')) abrir(); });
  return { abrir, atualizarBotao, exigir, jaRegistrou };
}
