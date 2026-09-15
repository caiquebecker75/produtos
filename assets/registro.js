// Registro de instalação: abre ao escanear o QR code (?qr=1) ou pelo botão "Registrar instalação".
// Pede nome, telefone e loja, pega a localização do aparelho e grava em Firestore/instalacoes,
// que só a equipe 75 LAB lê no painel (/painel/).
import { db } from './base.js?v=1';
import { chaveAcesso } from './acesso.js?v=1';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ler = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';
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
    parado: 'Vamos registrar a localização da loja.',
    buscando: 'Pegando a localização da loja…',
    ok: `<b>Localização registrada</b>${geo.pos ? ` · precisão de ${geo.pos.precisao} m` : ''}`,
    negado: '<b>Localização bloqueada.</b> Libere nas configurações do navegador para registrar onde a peça foi instalada.',
    tempo: '<b>Sem sinal de GPS agora.</b> Tente de novo perto da entrada da loja.',
    erro: '<b>Não deu para pegar a localização.</b> Tente de novo.',
    indisponivel: 'Este aparelho não informa a localização.',
  }[geo.estado];
  const tentar = ['negado', 'tempo', 'erro'].includes(geo.estado) ? '<button type="button" id="reg-geo-tentar">Tentar de novo</button>' : '';
  el.innerHTML = `<span class="dot">${PIN}</span><span>${txt}</span>${tentar}`;
  $('#reg-geo-tentar')?.addEventListener('click', pedirLocalizacao);
}

// ---------- telefone ----------
const soDigitos = (s) => s.replace(/\D/g, '').slice(0, 11);
function mascara(d) {
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function iniciarRegistro(P, { toast, ICON, senhaHash }) {
  const params = new URLSearchParams(location.search);
  const veioDoQR = params.has('qr');
  const chaveReg = `reg75:${P.slug}`;
  const btn = $('#btn-reg');

  const marcarRegistrado = (loja) => {
    btn.classList.add('ok');
    btn.querySelector('span').textContent = 'Instalação registrada';
    btn.title = loja ? `Registrada em ${loja}. Toque para registrar outra loja.` : '';
    $('.faixa-reg')?.remove();
  };
  const ultimo = ler(chaveReg);
  if (ultimo && Date.now() - ultimo.quando < 12 * 3600e3) marcarRegistrado(ultimo.loja);

  function faixa() {
    if ($('.faixa-reg') || btn.classList.contains('ok')) return;
    const f = document.createElement('div');
    f.className = 'faixa-reg';
    f.innerHTML = '<span>Instalação ainda não registrada.</span><button type="button">Registrar</button>';
    f.querySelector('button').addEventListener('click', abrir);
    document.body.appendChild(f);
  }

  function abrir() {
    if ($('.sheet-bg')) return;
    db(); // já vai baixando o Firebase
    if (geo.estado === 'parado' || geo.estado === 'tempo' || geo.estado === 'erro') pedirLocalizacao();
    const pessoa = ler('reg75:pessoa') || {};
    const bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.innerHTML = `
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="reg-titulo">
        <div class="sheet-top"><span class="tag">Registro de instalação</span><button class="fechar" type="button" aria-label="Fechar">${X}</button></div>
        <form id="reg-form" novalidate>
          <h2 id="reg-titulo">Onde a peça <b>está sendo instalada?</b></h2>
          <p class="peca">${esc(P.cliente)} · ${esc(P.nome)} ${esc(P.linha || '')}</p>
          <label class="campo"><span>Seu nome</span><input name="nome" autocomplete="name" required minlength="2" maxlength="80" value="${esc(pessoa.nome || '')}" placeholder="Nome e sobrenome"></label>
          <label class="campo"><span>Telefone (WhatsApp)</span><input name="telefone" type="tel" inputmode="tel" autocomplete="tel-national" required value="${esc(mascara(soDigitos(pessoa.telefone || '')))}" placeholder="(11) 91234-5678"></label>
          <label class="campo"><span>Loja onde está instalando</span><input name="loja" autocomplete="organization" required minlength="2" maxlength="140" placeholder="Rede e unidade. Ex.: Carrefour Pinheiros"></label>
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
    $('.fechar', bg).addEventListener('click', fechar); // só fecha no X (clicar fora não perde o que foi digitado)
    setTimeout(() => (pessoa.nome ? form.loja : form.nome).focus({ preventScroll: true }), 350);

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const erro = $('#reg-erro', bg);
      const nome = form.nome.value.trim().replace(/\s+/g, ' ');
      const telefone = soDigitos(tel.value);
      const loja = form.loja.value.trim().replace(/\s+/g, ' ');
      const invalidos = [];
      form.nome.setAttribute('aria-invalid', String(nome.length < 2)); if (nome.length < 2) invalidos.push('seu nome');
      tel.setAttribute('aria-invalid', String(telefone.length < 10)); if (telefone.length < 10) invalidos.push('o telefone com DDD');
      form.loja.setAttribute('aria-invalid', String(loja.length < 2)); if (loja.length < 2) invalidos.push('a loja');
      if (invalidos.length) {
        erro.textContent = `Preencha ${invalidos.join(', ')}.`;
        erro.hidden = false;
        return;
      }
      erro.hidden = true;
      const enviar = $('.enviar', form);
      enviar.disabled = true;
      enviar.textContent = geo.estado === 'buscando' ? 'Pegando localização…' : 'Enviando…';
      await aguardarGeo(8000);
      enviar.textContent = 'Enviando…';
      gravar('reg75:pessoa', { nome, telefone });
      try {
        const { fs, db: base } = await db();
        await fs.addDoc(fs.collection(base, 'instalacoes'), {
          projeto: P.slug,
          projetoNome: `${P.nome} ${P.linha || ''}`.trim().slice(0, 140),
          cliente: String(P.cliente || '').slice(0, 100),
          nome,
          telefone,
          loja,
          geo: geo.pos,
          geoStatus: geo.estado === 'buscando' ? 'tempo' : geo.estado,
          origem: veioDoQR ? 'qr' : 'link',
          aparelho: navigator.userAgent.slice(0, 200),
          senhaHash,
          criadoEm: fs.serverTimestamp(),
        });
        gravar('reg75:pessoa', { nome, telefone });
        gravar(chaveReg, { loja, quando: Date.now() });
        if (veioDoQR) history.replaceState(null, '', location.pathname + location.hash);
        marcarRegistrado(loja);
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
          document.getElementById('montagem')?.scrollIntoView();
        });
      } catch (e) {
        console.error(e);
        if (e.code === 'permission-denied') {
          // a senha da página foi trocada no painel depois que este aparelho entrou
          try { localStorage.removeItem(chaveAcesso(P.slug)); } catch {}
          erro.textContent = 'A senha desta página foi trocada. Digite a nova senha para registrar.';
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
      }
    });
  }

  btn.addEventListener('click', abrir);
  if (veioDoQR) {
    if (ultimo && Date.now() - ultimo.quando < 2 * 3600e3) {
      toast(`Você já registrou esta peça em ${ultimo.loja}. Para outra loja, toque em Registrar instalação.`);
    } else {
      pedirLocalizacao();
      abrir();
    }
  }
}
