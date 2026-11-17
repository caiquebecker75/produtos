// Lê as respostas da pesquisa Raio-X do PDV 2027 (Firestore instalacoes-75lab, coleção pesquisa_raiox)
// com o login do Firebase CLI deste Mac (dono do projeto). As regras bloqueiam leitura anônima de propósito.
//   node tools/raiox.cjs resumo          contagem total, por origem e por resposta (JSON numa linha)
//   node tools/raiox.cjs csv <arquivo>   exporta todas as respostas (sem e-mail de quem não autorizou)
const FT = '/Users/caiquebecker/.nvm/versions/node/v24.18.0/lib/node_modules/firebase-tools/lib/';
const auth = require(FT + 'auth');
const { requireAuth } = require(FT + 'requireAuth');
const { Client } = require(FT + 'apiv2');
const fs = require('fs');
const val = v => v == null ? '' : v.stringValue ?? v.booleanValue ?? v.timestampValue ?? v.integerValue ?? (v.mapValue ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, val(x)])) : '');
(async () => {
  const conta = auth.getGlobalDefaultAccount();
  if (!conta) throw new Error('Firebase CLI sem login (rode firebase login)');
  await requireAuth({ user: conta.user, tokens: conta.tokens, project: 'instalacoes-75lab' });
  const c = new Client({ urlPrefix: 'https://firestore.googleapis.com', apiVersion: 'v1', auth: true });
  let docs = [], page = '';
  do {
    const r = await c.get(`projects/instalacoes-75lab/databases/(default)/documents/pesquisa_raiox`, { queryParams: { pageSize: 300, ...(page ? { pageToken: page } : {}) } });
    docs = docs.concat(r.body.documents || []); page = r.body.nextPageToken;
  } while (page);
  const linhas = docs.map(d => { const f = d.fields || {}; return { id: d.name.split('/').pop(), criadoEm: val(f.criadoEm), origem: val(f.origem), email: val(f.consentimento) === true ? val(f.email) : '', ...val(f.respostas) }; })
    .filter(l => !String(l.origem).startsWith('teste'));
  const modo = process.argv[2] || 'resumo';
  if (modo === 'csv') {
    const cols = [...new Set(linhas.flatMap(Object.keys))];
    const q = s => '"' + String(s ?? '').replace(/"/g, '""') + '"';
    fs.writeFileSync(process.argv[3], [cols.join(','), ...linhas.map(l => cols.map(k => q(l[k])).join(','))].join('\n'));
    console.log(JSON.stringify({ ok: true, respostas: linhas.length, arquivo: process.argv[3] }));
    return;
  }
  const cont = k => linhas.reduce((a, l) => (String(l[k] || '').split(', ').filter(Boolean).forEach(v => a[v] = (a[v] || 0) + 1), a), {});
  console.log(JSON.stringify({ ok: true, respostas: linhas.length, com_email: linhas.filter(l => l.email).length,
    por_origem: cont('origem'), montado: cont('montado'), confirma: cont('confirma'), retrabalho: cont('retrabalho'), ar: cont('ar'), verba: cont('verba') }));
})().catch(e => { console.log(JSON.stringify({ ok: false, erro: e.message })); process.exit(1); });
