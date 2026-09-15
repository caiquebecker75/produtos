# Páginas de produto 75 LAB

Toda peça produzida pela 75 LAB sai com uma página de produto e um **QR code impresso** que vai junto na embalagem.

- **Página:** objetivo da peça, montagem passo a passo, vídeo, realidade aumentada (tamanho real no chão da loja), medidas e ficha técnica, checklist e FAQ de execução.
- **Senha de acesso:** cada página só abre com a senha definida no painel (card "Projetos e senhas"). Vale para o QR e para o link.
- **No ar / fora do ar:** botão no painel. Fora do ar, o link e o QR mostram "Página fora do ar" (sem senha e sem conteúdo) e nenhum registro é aceito.
- **QR code** (`?qr=1`): depois da senha, abre um mini questionário (nome, telefone, loja) e pega a **localização do aparelho** na hora.
- **Painel interno** (`/painel/`): registros em tempo real, mapa, filtros por projeto e período, exportação para Excel, senha de cada página e etiqueta QR pronta para imprimir (`/painel/qr.html?p=<pasta>`). Só entra conta Google **@75lab.com.br**.

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
- **Vídeo:** MP4 em `<pasta>/video/` (o GitHub recusa arquivo acima de 100 MB). Comprimir mantendo 1080p:
  `swift tools/video-comprimir.swift entrada.mp4 <pasta>/video/montagem.mp4 1700` (kbps; 3 min ≈ 40 MB).
  Não use os presets do `avconvert`: o de 720p saiu com 7 Mbps, maior que o original.
- **Capítulos do vídeo:** `swift tools/video-legendas.swift video.mp4` lê as legendas gravadas no vídeo (OCR do macOS)
  com a minutagem; serve para montar `video.capitulos` e conferir o passo a passo com o que é falado.
- **Vistas e planificado:** `galeria` (renders com fundo transparente, em WebP) e `medidas.planificado` (arte aberta).

## Registro de instalação e painel

- Firebase `instalacoes-75lab` (Firestore em `southamerica-east1`, login Google). Configuração pública em `assets/firebase-config.js`.
- Coleção `instalacoes`: `projeto`, `projetoNome`, `cliente`, `nome`, `telefone`, `loja`, `geo {lat, lng, precisao}`,
  `geoStatus` (`ok`, `negado`, `tempo`, `erro`, `indisponivel`), `origem` (`qr`/`link`), `aparelho`, `criadoEm`.
- Regras em `firestore.rules`: qualquer pessoa **cria** (com validação de campos); só e-mail verificado `@75lab.com.br` lê ou apaga.
  Publicar: `firebase deploy --only firestore:rules`.
- A localização depende da permissão do navegador (o celular pergunta uma vez). Se o promotor negar, o registro vai sem ponto e o painel mostra "Bloqueada".
- Domínio novo para o painel? Adicionar em Firebase → Authentication → Configurações → Domínios autorizados.
- `projetos.json` lista as páginas no painel (inclusive as que ainda não têm registro) com o **marcador do mapa** de cada uma (`cor` e `sigla`; `formato` opcional `gota`/`quadrado`). O `novo-projeto.mjs` já registra com a primeira cor livre da paleta (`painel/marcadores.js`). Não troque a cor de uma página que já tem pontos no mapa.

## Senha de acesso

- Documento `senhas/{pasta}` (`senha`, `hash`, `atualizadoEm`, `atualizadoPor`), só a equipe lê e grava. Página nova começa **bloqueada** até alguém criar a senha no painel.
- `hash` = SHA-256 de `<pasta>:<senha em minúsculas, sem espaços nas pontas>` (`assets/senha.js`).
- A página confere lendo `portas/{pasta}/chaves/{hash}`: a regra só deixa ler com o hash certo, então a senha nunca vai para o navegador.
  O registro de instalação também leva `senhaHash` e é recusado se a senha estiver errada ou tiver sido trocada.
- O aparelho guarda o hash depois de acertar; ao trocar a senha no painel, todos precisam digitar a nova.
- A senha protege o fluxo (quem registra e quem vê a página pelo QR), não o conteúdo: o texto da página está neste repositório público.

## No ar / fora do ar

- Documento público `paginas/{pasta}` (`ativo`, `atualizadoEm`, `atualizadoPor`): qualquer um lê um documento (a página precisa saber), só a equipe lista e grava. Sem documento = no ar.
- As regras de `portas` e de `instalacoes` exigem a página no ar: fora do ar, nem a senha certa abre e nenhum registro entra.
- É um bloqueio de acesso, não uma remoção: o HTML continua no GitHub Pages. Para apagar de vez, remova a pasta do repositório.
