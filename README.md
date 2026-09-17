# Páginas de produto 75 LAB

Toda peça produzida pela 75 LAB sai com uma página de produto e um **QR code impresso** que vai junto na embalagem.

- **Página:** objetivo da peça, montagem passo a passo, vídeo, realidade aumentada (tamanho real no chão da loja), medidas e ficha técnica, checklist e FAQ de execução.
- **Senha de acesso:** cada página só abre com a senha definida no painel (card "Projetos e senhas"). Vale para o QR e para o link.
- **Acesso livre:** botão "Liberar sem senha" no painel, por página. A página abre direto e o registro entra sem senha; "Exigir senha" volta a pedir a senha guardada.
- **No ar / fora do ar:** botão no painel. Fora do ar, o link e o QR mostram "Página fora do ar" (sem senha e sem conteúdo) e nenhum registro é aceito.
- **Registro obrigatório:** pelo QR ou pelo link, depois da senha (e da escolha de peças) a página só abre depois do mini questionário (nome, telefone, loja) com a **localização do aparelho**. A tela não tem X.
  A **localização é obrigatória**: sem ela o botão não envia (mostra como liberar no iPhone e no Android) e as regras recusam registro com `geo` nulo.
  Pula só se o aparelho já registrou as mesmas peças nas últimas 12 h. Sem internet na loja, aparece a opção de ver a montagem e registrar quando o sinal voltar. `?qr=1` só marca a origem "QR code" no painel.
- **Painel interno** (`/painel/`): registros em tempo real, mapa, filtros por projeto e período, exportação para Excel, senha de cada página e etiqueta QR pronta para imprimir (`/painel/qr.html?p=<pasta>`). Só entra conta Google **@75lab.com.br**.

Publicado no GitHub Pages: `https://projetos.75lab.com.br/produtos/<pasta>/` · painel em `https://projetos.75lab.com.br/produtos/painel/`

| Pasta | Peça |
|---|---|
| `modelo/` | Página modelo com todos os blocos (use para testar o registro) |
| `savencia-display-pp-polenguinho/` | Savencia · Display PP Polenguinho |
| `scala-queijos-scala-flow/` | Queijos Scala · Gravitacional Scala Flow (4 configurações: modelo 1 com 1 ou 3 módulos, modelo 2 com 1 ou 2 módulos), acesso livre |
| `savencia-enxoval-frescatino/` | Savencia · Enxoval Frescatino (5 peças: display, wobbler, gravitacional, frame, clipstrip) |

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
e `etiqueta.pdf` / `etiqueta.png` (etiqueta pronta 10 × 15 cm, 300 dpi), mais `etiqueta-livre.pdf` / `.png` sem o passo da senha
(o link "Etiqueta QR" do painel mostra essa quando a página está com acesso livre).

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

## Acesso livre (página sem senha)

- Campo `semSenha` (com `semSenhaEm`, `semSenhaPor`) no mesmo documento `paginas/{pasta}`. O painel grava com merge, então no ar/fora do ar e acesso livre não se apagam.
- Ligado: `assets/acesso.js` pula a tela de senha, o registro vai sem `senhaHash` e as regras (`paginaSemSenha`) aceitam. Fora do ar continua valendo por cima.
- A senha em `senhas/{pasta}` não é apagada: ao clicar "Exigir senha", volta a valer (quem entrou sem senha é recarregado e precisa digitar).
- O aparelho lembra que a página estava livre (`livre75:<pasta>`) para abrir sem internet na loja.
- Nas regras, campo que pode faltar no documento é lido com `.get('campo', padrão)`: ler `data.ativo` num documento sem `ativo` dá erro e recusa tudo.

## No ar / fora do ar

- Documento público `paginas/{pasta}` (`ativo`, `atualizadoEm`, `atualizadoPor`): qualquer um lê um documento (a página precisa saber), só a equipe lista e grava. Sem documento = no ar.
- As regras de `portas` e de `instalacoes` exigem a página no ar: fora do ar, nem a senha certa abre e nenhum registro entra.
- É um bloqueio de acesso, não uma remoção: o HTML continua no GitHub Pages. Para apagar de vez, remova a pasta do repositório.

## Enxoval (várias peças numa página)

- No JSON, `"kit": [{ "id", "nome", "nomeCurto", "resumo", "miniatura", "imagem", ...blocos da peça }]`. Cada peça aceita os
  mesmos blocos de uma página simples (`galeria`, `montagem`, `caixa` (o que vem na caixa), `video`, `ar`, `medidas`, `checklist`, `faq`).
  O `objetivo` e o `faq` da raiz valem para o enxoval inteiro.
- Fluxo: senha → janela **"Quais peças você vai executar agora?"** (`assets/selecao.js`) → questionário (mostra as peças) → página só com as peças escolhidas.
  "Trocar peças" no topo refaz a escolha sem recarregar. `?pecas=display,wobbler` no link abre direto com essas peças (o QR do enxoval sempre pergunta).
- O registro grava `pecas: ["display", ...]`. No painel: filtro **Peça**, peças na tabela, no popup do mapa, no Excel e contagem por peça.
  Os nomes vêm de `projetos.json` → `"pecas": [{ "id", "nome" }]`.
- AR com orientação de parede/gôndola: `ar.posicionamento: "wall"`.
- **Desabilitar uma peça:** no painel, cada enxoval tem os chips "Peças na página"; clicar desabilita/habilita. Grava `paginas/{pasta}.pecasOff` (com `pecasOffEm`, `pecasOffPor`, merge).
  A peça some da janela de escolha e da página (com uma só peça habilitada a página abre direto nela), e as regras (`temPecaDesligada`) recusam registro novo com ela.
  Registros antigos continuam no painel. O painel não deixa desabilitar a última peça: para bloquear tudo, "Tirar do ar".
