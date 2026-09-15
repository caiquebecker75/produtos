// Cria a página de um produto novo a partir da página modelo e registra no painel.
//   node tools/novo-projeto.mjs <cliente-peca-linha> "Cliente" "Nome da peça" ["Linha"]
// Ex.: node tools/novo-projeto.mjs famosa-display-maromba-m "Agrícola Famosa" "Display Maromba" "M"
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [slug, cliente = 'Cliente', nome = 'Nome da peça', linha = ''] = process.argv.slice(2);
if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error('Uso: node tools/novo-projeto.mjs <slug-em-minusculas-com-hifen> "Cliente" "Nome da peça" ["Linha"]');
  process.exit(1);
}
const pasta = path.join(raiz, slug);
if (existsSync(pasta)) { console.error(`A pasta ${slug}/ já existe.`); process.exit(1); }

let html = readFileSync(path.join(raiz, 'modelo', 'index.html'), 'utf8');
const bloco = html.match(/<script type="application\/json" id="projeto">([\s\S]*?)<\/script>/);
const P = JSON.parse(bloco[1]);
Object.assign(P, { slug, cliente, nome, linha, imagem: 'img/display.webp', logoCliente: 'img/logo-cliente.webp', ar: null });
P.video = null;
P.medidas.desenho = 'img/dimensional.webp';

const titulo = `${nome}${linha ? ' ' + linha : ''}`;
const url = `https://projetos.75lab.com.br/produtos/${slug}/`;
html = html
  .replace(bloco[1], `\n${JSON.stringify(P, null, 2)}\n`)
  .replace(/<title>.*<\/title>/, `<title>${titulo} · ${cliente} | Montagem 75 LAB</title>`)
  .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="Treinamento de montagem de ${titulo} (${cliente}): passo a passo, medidas, checklist e FAQ de execução.">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${titulo} · Treinamento de montagem">
<meta property="og:description" content="Passo a passo, medidas, checklist e FAQ de execução. 75 LAB para ${cliente}.">
<meta property="og:image" content="${url}og.jpg">
<meta name="twitter:card" content="summary_large_image">`)
  .replace(/<!--\s*COMO CRIAR[\s\S]*?-->\n/, '');

mkdirSync(path.join(pasta, 'img'), { recursive: true });
writeFileSync(path.join(pasta, 'index.html'), html);

const lista = JSON.parse(readFileSync(path.join(raiz, 'projetos.json'), 'utf8'));
lista.unshift({ slug, cliente, nome: titulo, criado: new Date().toISOString().slice(0, 10) });
writeFileSync(path.join(raiz, 'projetos.json'), JSON.stringify(lista, null, 2) + '\n');

console.log(`${slug}/index.html criado e registrado em projetos.json
Próximos passos:
  1. Editar o JSON da página (${slug}/index.html)
  2. Imagens em ${slug}/img/ (display.webp sem fundo, logo-cliente.webp, dimensional.webp)
  3. node tools/og.mjs ${slug}   (miniatura do WhatsApp)
  4. node tools/qr.mjs ${slug}   (QR + etiqueta de impressão)
  5. git add -A && git commit && git push`);
