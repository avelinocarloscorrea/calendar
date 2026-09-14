# Histórico

## 0.6 — interface redesenhada e impressão com prévia
- **Interface nova**: etapas Modelo → Fotos → Imprimir, abas (Fotos, Formato,
  Datas, Cores, Acabamento, Modelos), estilos do mês em cartões visuais,
  galeria inicial com miniaturas reais.
- **Fotos em lote**: várias fotos de uma vez entram em ordem nos meses vazios.
- **Imprimir e baixar**: prévia das folhas e verificação (meses sem foto,
  resolução baixa, margem do wire-o).
- **Páginas prontas mesmo sem foto**: capa tipográfica e bloco de cor com o
  número do mês; tipografia que escala com o tamanho (pôster A3, ímã).
- **Qualidade**: fotos guardadas no IndexedDB em até 3600 px (~300 dpi), aviso
  de DPI calculado sobre a foto original, PDF com JPEG embutido (13 fotos:
  de 24 MB para 1,9 MB).

## 0.5 — assistente de início
- Tela de início nova: ao abrir um calendário do zero, você escolhe em 4
  passos (tamanho → estilo do mês → paleta → encadernação) e já vê a prévia
  de cada escolha. Continua dando para pular direto para um dos modelos
  prontos.

## 0.4 — exportar já pronto para cortar
- **Modo automático** de exportação (agora o padrão): ao gerar o PDF ou
  imprimir, a ferramenta decide sozinha se o tamanho escolhido sai exato ou
  centralizado numa folha A4 com marcas de corte — sem precisar configurar
  nada antes. Continua dando para escolher manualmente se preferir mandar
  para a gráfica num tamanho exato.

## 0.3 — editor de foto embutido, encadernação e mais modelos
- **Editor de foto** direto no painel (arrastar, zoom, rotação, espelhar,
  brilho/contraste/saturação/sépia/preto-e-branco), com dois presets rápidos
  — **Básico** e **Clássico** — para a capa e a foto de cada mês. Sem popup:
  os controles ficam ao lado, editando ao vivo, e a foto reabre exatamente
  como você deixou.
- **Encadernação de verdade**: wire-o (topo ou lateral), espiral ou canto —
  a grade do mês desvia da faixa do furo, com estimativa de espessura do
  miolo. Tamanho **mesa cavalete** dobra a folha automaticamente na hora de
  exportar.
- +2 estilos de mês (moldura decorativa, foto no canto), +2 tamanhos (ímã de
  geladeira, mesa cavalete), 8 modelos completos prontos para aplicar.
- O painel direito volta a abrir sozinho ao trocar de mês, se estava
  fechado.
- Corrigido um bug real: uma foto recém-adicionada, sem nenhum ajuste ainda,
  aparecia com zoom/rotação/saturação nos valores mínimos em vez dos
  valores neutros.

## 0.1 — primeira versão
- Calendário com capa + 12 meses, 6 estilos de página e feriados nacionais,
  estaduais e comemorativos calculados localmente. Exportação em PDF
  vetorial, PNG ou impressão direta. Nada é enviado a servidor nenhum — fotos
  e projeto ficam só no navegador.
