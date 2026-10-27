// Pulso da página: conta quem ABRIU, mesmo que não termine o registro.
// Sem nada pessoal: só o projeto, a etapa, de onde veio (QR ou link), o sistema do aparelho
// e um código de sessão sorteado na hora. É o que diz se o QR foi escaneado de verdade
// quando não aparece nenhum registro no painel.
import { db } from './base.js?v=1';

const CHAVE = 'pulso75';
const ETAPAS = ['abriu', 'senha', 'senha-ok', 'fora-do-ar', 'pecas', 'registro', 'registrou'];

function sessao() {
  try {
    let s = sessionStorage.getItem(CHAVE);
    if (!s) { s = Math.random().toString(36).slice(2, 12); sessionStorage.setItem(CHAVE, s); }
    return s;
  } catch { return 'semsessao'; }
}

function aparelho() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  return 'outro';
}

function origem() {
  const q = new URLSearchParams(location.search);
  return q.has('qr') ? 'qr' : q.has('equipe') ? 'equipe' : 'link';
}

// nunca atrapalha a página: erro de rede ou de regra é engolido
export function pulso(slug, etapa) {
  if (!ETAPAS.includes(etapa)) return Promise.resolve();
  return db().then(({ fs, db: base }) => fs.addDoc(fs.collection(base, 'acessos'), {
    projeto: String(slug || '').slice(0, 80),
    etapa,
    origem: origem(),
    sessao: sessao(),
    so: aparelho(),
    criadoEm: fs.serverTimestamp(),
  })).catch(() => {});
}
