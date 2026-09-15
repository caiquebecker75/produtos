# Páginas de produto 75 LAB

Toda peça produzida pela 75 LAB sai com uma página de produto e um **QR code impresso** que vai junto na embalagem.

- **Página:** objetivo da peça, montagem passo a passo, vídeo, realidade aumentada (tamanho real no chão da loja), medidas e ficha técnica, checklist e FAQ de execução.
- **QR code** (`?qr=1`): abre um mini questionário (nome, telefone, loja) e pega a **localização do aparelho** na hora.
- **Painel interno** (`/painel/`): registros em tempo real, mapa, filtros por projeto e período, exportação para Excel. Só entra conta Google **@75lab.com.br**.

Publicado no GitHub Pages: `https://projetos.75lab.com.br/produtos/<pasta>/` · painel em `https://projetos.75lab.com.br/produtos/painel/`

| Pasta | Peça |
|---|---|
| `modelo/` | Página modelo com todos os blocos (use para testar o registro) |
| `savencia-display-pp-polenguinho/` | Savencia · Display PP Polenguinho |

## Criar a página de uma peça nova

Pré-requisito (uma vez): `cd tools && npm install sharp qrcode-generator puppeteer-core`.

```bash
node tools/novo-projeto.mjs cliente-peca-linha "Cliente" "Nome da peça" "Linha"
# edite o JSON em <pasta>/index.html e coloque as imagens em <pasta>/img/
node tools/recorte-fundo.mjs render.png <pasta>/img/display.webp   # tira fundo liso do render
node tools/og.mjs <pasta>                                           # miniatura do WhatsApp
node tools/qr.mjs <pasta>                                           # QR + etiqueta de impressão
git add -A && git commit -m "Página <peça>" && git push
```

`tools/qr.mjs` grava em `<pasta>/qr/`: `qr-code.svg` e `qr-code.png` (só o código, para a arte da embalagem)
e `etiqueta.pdf` / `etiqueta.png` (etiqueta pronta 10 × 15 cm, 300 dpi).

### O JSON da página

Fica em `<script type="application/json" id="projeto">` dentro do `index.html`. Bloco sem dados some da página.
Texto aceita `**negrito**`. Campos: `slug`, `cliente`, `logoCliente`, `nome`, `linha`, `subtitulo`, `tipo`, `imagem`,
`tempoMontagem`, `objetivo {texto, pontos[]}`, `pecas[] {qtd, nome}`, `ferramentas`, `montagem[] {titulo, texto, alerta}`,
`video {mp4 | youtube, orientacao, poster, texto, duracao}`, `ar {glb, usdz, poster}`,
`medidas {desenho, legenda, principais[], grupos[] {titulo, texto, itens[[rótulo, valor]]}}`,
`checklist[] {grupo, itens[]}`, `faq[] {p, r}`.

- **3D / AR:** o modelo vai para o repositório [`caiquebecker75/ar`](https://github.com/caiquebecker75/ar) pelo pipeline de lá
  (GLB para Android, USDZ para iPhone, escala travada em tamanho real). Aqui só se aponta `ar.glb` e `ar.usdz` para os arquivos publicados.
- **Vídeo:** MP4 em `<pasta>/video/` (até ~90 MB; acima disso use YouTube não listado com `"youtube": "<id>"`).

## Registro de instalação e painel

- Firebase `instalacoes-75lab` (Firestore em `southamerica-east1`, login Google). Configuração pública em `assets/firebase-config.js`.
- Coleção `instalacoes`: `projeto`, `projetoNome`, `cliente`, `nome`, `telefone`, `loja`, `geo {lat, lng, precisao}`,
  `geoStatus` (`ok`, `negado`, `tempo`, `erro`, `indisponivel`), `origem` (`qr`/`link`), `aparelho`, `criadoEm`.
- Regras em `firestore.rules`: qualquer pessoa **cria** (com validação de campos); só e-mail verificado `@75lab.com.br` lê ou apaga.
  Publicar: `firebase deploy --only firestore:rules`.
- A localização depende da permissão do navegador (o celular pergunta uma vez). Se o promotor negar, o registro vai sem ponto e o painel mostra "Bloqueada".
- Domínio novo para o painel? Adicionar em Firebase → Authentication → Configurações → Domínios autorizados.
- `projetos.json` lista as páginas no painel (inclusive as que ainda não têm registro). O `novo-projeto.mjs` já atualiza.
