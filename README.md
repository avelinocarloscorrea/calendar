# Calendar Studio

Gera um calendário personalizado (parede, quadrado, ímã de geladeira ou
cavalete de mesa) com fotos suas e os feriados do Brasil, pronto para
impressão — **PDF**, **PNG** ou impressão direta.

Roda inteiro no navegador: sem instalação, sem back-end e **sem enviar nada**.
Fotos e projeto ficam só no navegador (`localStorage`); para backup ou levar
para outro computador, use **Salvar projeto** (`.json`).

## O que faz

- Documento fixo: capa (opcional) + 12 páginas de mês, ano corrente.
- 7 tamanhos: parede A4/A3 retrato, A4 paisagem, quadrado 210×210, mesa A6
  paisagem, ímã 100×140, cavalete de mesa 148×105 (folha dobrada, face +
  painel de apoio).
- 6 estilos de mês e paletas de cor prontas; 8 modelos completos (`Modelos`)
  e uma tela de início com assistente de 4 passos (tamanho → estilo do mês →
  paleta → encadernação).
- 1 foto por mês + 1 de capa, com editor embutido (arrastar, zoom, rotação
  fina, espelhar, brilho/contraste/saturação/sépia, presets
  "Básico"/"Clássico") — toda imagem é sempre redesenhada em canvas antes de
  entrar no projeto (sem EXIF/GPS).
- Feriados nacionais (inclusive móveis, calculados localmente), estaduais por
  UF, pontos facultativos, datas comemorativas, e uma lista de eventos seus —
  tudo marcado na grade do mês.
- Encadernação/furação real: nenhuma (folha solta), wire-o topo/esquerda,
  espiral topo, corte de canto — o layout de cada página desvia da faixa do
  furo, com estimativa de espessura do miolo.
- Exportação com margens e marcas de corte já prontas para uma folha A4.

Guia do usuário ilustrado em [`guia.html`](guia.html).

## Estrutura

```
index.html            marcação da interface
guia.html              guia do usuário
js/                     11 scripts clássicos, carregados em ordem
  config calendar engine fonts images install io mobile pen ui wizard
css/                    base layout studio mobile print util guia
assets/
  favicon.svg / icon.svg
  arimo-*.woff2         fonte da interface e do PDF
  playfair.woff2        fonte de marca
vendor/core/            núcleo compartilhado com as outras ferramentas
  Esmeralda Paper (dates/blocks/binding/imgedit) — ver vendor/core/README.txt
.htaccess               blindagem da pasta (Apache / LiteSpeed)
```

Sem build, sem dependências. Abra `index.html` no navegador — funciona
inclusive por `file://` (mantenha `css/`, `js/`, `vendor/` e `assets/` ao
lado).

## Rodar local

```
python3 -m http.server 8000
# http://localhost:8000/
```

Servir por HTTP é útil para testar com a CSP vindo como cabeçalho (o
`.htaccess`), não só pela tag `<meta>`.

## Documentação

- `CHANGELOG.md` — histórico de versões.

## Autor

Carlos Avelino Correa — <https://github.com/avelinocarloscorrea>

## Código-fonte

<https://github.com/avelinocarloscorrea/calendar> — repositório privado por
enquanto; a ideia é abrir para a comunidade mais adiante.

## Licença

[MIT](LICENSE).
