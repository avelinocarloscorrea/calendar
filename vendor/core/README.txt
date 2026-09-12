Núcleo compartilhado (dates.js, blocks.js, binding.js, imgedit.js).

São os mesmos módulos usados pelas outras ferramentas Esmeralda Paper
(Planner Studio, Polaroide Studio) — feriados/datas, o construtor de blocos,
a estimativa de acabamento e o editor de foto embutido. Aqui ficam como cópia
estática, direto na origem do app (mesma pasta, sem CDN nem build), pra manter
a Content-Security-Policy `script-src 'self'`.
