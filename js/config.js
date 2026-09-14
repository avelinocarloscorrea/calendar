/*
 * Calendar Studio — js/config.js
 *
 * Ferramenta de página única para montar um calendário personalizado (capa +
 * 12 meses, com foto opcional por mês) e exportar um PDF vetorial pronto para
 * impressão. Roda inteira no navegador: nada é enviado a servidor nenhum.
 * Sem build — os arquivos js/ são scripts clássicos carregados em ordem por
 * index.html e compartilham o escopo global.
 *
 * Mapa:
 *   config.js    — utilitários, ícones, tamanhos, paletas, estilos, DEFAULTS
 *   vendor/core/pen.js — "caneta" única (SVG na tela, PDF com fontes incorporadas)
 *   images.js    — importar/sanitizar foto (tira EXIF/GPS, redimensiona)
 *   calendar.js  — estado, migração, expand() das páginas, desenho (capa/mês)
 *   io.js        — exportar PDF/PNG/impressão, salvar/abrir projeto .json
 *   ui.js        — controles, painéis, diálogos, eventos, init
 *   mobile.js    — casca de celular
 */
"use strict";

/* ---------- utilitários ---------- */
const $  = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const MM = 96 / 25.4;                         // 1 mm em px CSS de referência
const PT = 72 / 25.4;                         // 1 mm em pontos PDF
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, d) => { const n = +v; return Number.isFinite(n) ? n : d; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const downloadBlob = (blob, name) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
function sanitizeText(v, max = 240) {
  // remove caracteres de controle (preserva tab/quebra de linha), mantém o resto.
  return String(v == null ? '' : v)
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').slice(0, max);
}
const hexOr = (v, d) => (HEX.test(v) ? v : d);

/* ---------- ícones (SVG autorais) ---------- */
const ICONS = {
  grid:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  check:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/>',
  calendar:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  page:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  photo:'<rect x="3" y="4" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M4 15.5l4.5-4a2 2 0 0 1 2.7 0L18 17.5"/>',
  bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>',
  list:'<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1.3"/><circle cx="4" cy="12" r="1.3"/><circle cx="4" cy="18" r="1.3"/>',
  star:'<path d="M12 3l2.6 5.7L21 9.5l-4.5 4.3L17.6 21 12 17.6 6.4 21l1.1-7.2L3 9.5l6.4-.8z"/>',
  palette:'<path d="M12 3a9 9 0 1 0 0 18c1.6 0 1.9-1.1 1.2-2-.8-1-.3-2.2 1-2.2H17a4 4 0 0 0 4-4c0-4.5-4-7.8-9-7.8z"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="10" r="1"/>',
  ruler:'<rect x="2" y="7" width="20" height="10" rx="1.5"/><path d="M6 7v4M10 7v3M14 7v4M18 7v3"/>',
  binding:'<rect x="8" y="3" width="12" height="18" rx="2"/><path d="M4 6h3M4 10h3M4 14h3M4 18h3"/>',
  layout:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  chevleft:'<path d="M15 5l-7 7 7 7"/>',
  chevright:'<path d="M9 5l7 7-7 7"/>',
  caret:'<path d="M9 6l6 6-6 6"/>',
  zoomin:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/>',
  zoomout:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M8 11h6"/>',
  fit:'<path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"/>',
  panelleft:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  panelright:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',
  eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff:'<path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 4.2A11 11 0 0 1 12 4c6.5 0 10 7 10 7a17.7 17.7 0 0 1-3 4M6.6 6.6C3.9 8.2 2 12 2 12s3.6 7 10 7a11 11 0 0 0 4.3-.9"/>',
  more:'<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M9 7V4h6v3"/>',
  copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  filepdf:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  filenew:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M12 12v6M9 15h6"/>',
  imagedown:'<rect x="3" y="3" width="18" height="13" rx="2.5"/><circle cx="8.5" cy="8" r="1.5"/><path d="M4 13l4-3.2a2 2 0 0 1 2.6 0L15 13M12 17v5m0 0l2.5-2.5M12 22l-2.5-2.5"/>',
  printer:'<path d="M7 9V3h10v6"/><rect x="6" y="14" width="12" height="7" rx="1"/><path d="M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/>',
  save:'<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h7"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v1"/><path d="M3.2 9h17.6l-1.8 9.2A2 2 0 0 1 17 20H7a2 2 0 0 1-2-1.8z"/>',
  download:'<path d="M12 3v13M7 12l5 5 5-5M5 21h14"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.3-2.7 4M12 17h.01"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  cursor:'<path d="M5 3l6 16 2.2-6.8L20 10z"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  sliders:'<path d="M4 7h9M4 12h4M4 17h11"/><circle cx="16" cy="7" r="2.3"/><circle cx="10" cy="12" r="2.3"/><circle cx="18" cy="17" r="2.3"/>',
  undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h11a6 6 0 0 1 0 12H8"/>',
  redo:'<path d="M15 14l5-5-5-5"/><path d="M20 9H9a6 6 0 0 0 0 12h7"/>',
};
function injectIcons(root = document) {
  root.querySelectorAll('[data-i]').forEach(el => {
    const g = ICONS[el.getAttribute('data-i')]; if (!g) return;
    el.insertAdjacentHTML('afterbegin',
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${g}</svg>`);
    el.removeAttribute('data-i');
  });
}
function iconSVG(name) {
  const g = ICONS[name] || ICONS.page;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${g}</svg>`;
}

const ACERVO_URL = 'https://www.esmeraldapaper.com.br/ferramentas/';
const FEEDBACK_URL = 'https://www.esmeraldapaper.com.br/avaliar-ferramentas/?tool=calendar';
// Calendário Personalizado de Mesa e Parede (Wire-o) — produto já publicado
// que corresponde exatamente ao que esta ferramenta gera.
const PRINT_CTA_URL = 'https://www.esmeraldapaper.com.br/produto/calendario-personalizado-mesa-ou-parede/?utm_source=calendarstudio&utm_medium=tool_cta&utm_campaign=imprimir_profissionalmente';

/* ---------- tamanhos (mm) ---------- */
const SIZES = {
  a4p:    { label: 'Parede A4 retrato — 210 × 297 mm', w: 210, h: 297 },
  a3p:    { label: 'Parede A3 retrato — 297 × 420 mm', w: 297, h: 420 },
  a4l:    { label: 'Parede A4 paisagem — 297 × 210 mm', w: 297, h: 210 },
  square: { label: 'Quadrado — 210 × 210 mm', w: 210, h: 210 },
  a6l:    { label: 'Mesa A6 paisagem — 148 × 105 mm', w: 148, h: 105 },
  magnet: { label: 'Ímã de geladeira — 100 × 140 mm', w: 100, h: 140 },
  standee: { label: 'Mesa cavalete (dobra em 2) — face 148 × 105 mm', w: 148, h: 105, stand: true },
  // 12 meses em poucas folhas
  posterA3: { label: 'Pôster anual A3 — 12 meses numa folha', w: 297, h: 420, layout: 'year' },
  posterA2: { label: 'Pôster anual A2 — 420 × 594 mm', w: 420, h: 594, layout: 'year' },
  econA4:  { label: 'Econômico A4 — 6 meses por página', w: 210, h: 297, layout: 'half' },
  pocket:  { label: 'Bolso — cartão 54 × 86 mm (frente e verso)', w: 54, h: 86, layout: 'year', pocket: true },
};

/* ---------- encadernação (reserva margem + guia de furo) ---------- */
const BINDING_TYPES = {
  none:     { label: 'Sem encadernação (folha solta)', edge: null },
  // furação pela norma (vendor/core/print.js): wire-o 3:1 = passo 8,47 mm, espiral 4:1 = 6,35 mm
  wireoTop: { label: 'Wire-o no topo (parede, pendurar)', edge: 'top', marginMm: 14, spec: 'wireo31', hanger: true },
  wireoLeft:{ label: 'Wire-o lateral (mesa, folhear)', edge: 'left', marginMm: 14, spec: 'wireo31' },
  spiralTop:{ label: 'Espiral no topo', edge: 'top', marginMm: 12, spec: 'coil41' },
  corner:   { label: 'Grampo de canto (sem furo)', edge: null, marginMm: 0 },
};

/* ---------- paletas de cor (1 clique) — mesmas do Planner Studio ---------- */
const PALETTES = {
  esmeralda: { label: 'Esmeralda',  ink: '#33403b', accent: '#a97f3d', paperBg: '#ffffff' },
  grafite:   { label: 'Grafite',    ink: '#2b2f33', accent: '#6b7280', paperBg: '#ffffff' },
  marinho:   { label: 'Marinho',    ink: '#1f3a52', accent: '#b06a3b', paperBg: '#ffffff' },
  ameixa:    { label: 'Ameixa',     ink: '#3f2b40', accent: '#8a6d3b', paperBg: '#fdfbf7' },
  floresta:  { label: 'Floresta',   ink: '#26382c', accent: '#7a8450', paperBg: '#ffffff' },
  sepia:     { label: 'Sépia',      ink: '#4a3b2a', accent: '#9c6b3f', paperBg: '#faf5ea' },
  pb:        { label: 'Preto e branco', ink: '#1a1a1a', accent: '#555555', paperBg: '#ffffff' },
};

/* ---------- estilos de página de mês ---------- */
const MONTH_STYLES = {
  fototopo:  { label: 'Foto no topo',  desc: 'foto ocupa a metade de cima, grade embaixo' },
  fotofundo: { label: 'Foto de fundo', desc: 'foto ao fundo da página inteira, grade num painel translúcido' },
  sografe:   { label: 'Só a grade',    desc: 'sem foto — minimalista' },
  fotolado:  { label: 'Foto ao lado',  desc: 'foto num terço lateral, grade ao lado' },
  moldura:   { label: 'Moldura (pôster)', desc: 'foto de fundo com filete decorativo e a grade num cartão central' },
  fotocanto: { label: 'Foto no canto', desc: 'miniatura no canto do título, grade ocupa quase a página inteira' },
};

const defaultYear = () => (new Date().getMonth() >= 8 ? new Date().getFullYear() + 1 : new Date().getFullYear());

/* ---------- predefinições ---------- */
const DEFAULTS = {
  year: defaultYear(),
  weekStart: 'mon',
  uf: '',
  holNacional: true,
  holFacultativo: false,
  holComemorativa: false,
  events: '',
  palette: 'esmeralda',
  ink: '#33403b', accent: '#a97f3d', paperBg: '#ffffff',
  size: 'a4p',
  style: 'fototopo',
  title: 'Calendário',
  owner: '',
  showCover: true,
  coverPhoto: '',
  coverPhotoSrc: '',
  coverPhotoEdit: null,
  bindGsm: 180,
  bindKind: 'couche',
  binding: 'none',            // chave de BINDING_TYPES
  showPunch: false,           // guia de furo (só tela)
  printPunch: false,          // idem, também no PDF/impressão
  exportMode: 'auto',         // auto (decide sozinho) | real | fit
  sheet: 'a4',                // a4 | a3 (folha de saída p/ o modo "fit")
  exportDPI: 300,
  startMonth: 1,              // 1–12: calendário de 12 meses a partir deste mês (ano letivo: 8)
  showMoon: false,            // fases da lua nos dias
  showWeekNum: false,         // número da semana ISO 8601 em cada linha
  bleedMm: 0,                 // sangria (gráfica)
  cropMarks: true,            // marcas de corte fora da sangria
  pdfColor: 'rgb',            // rgb (casa) | cmyk (gráfica, PDF/X-4)
  inkSave: 0,                 // % de economia de tinta
  acrylic: false,             // painéis de vidro translúcido (mesmo efeito do Polaroide Studio)
};

function emptyMonth() { return { photo: '', photoSrc: '', photoEdit: null, caption: '' }; }

const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

/* ---------- modelos (início rápido) ---------- */
// Cada modelo só ajusta SETTINGS (tamanho, estilo, paleta, encadernação,
// capa) — fotos e legendas já preenchidas pelo usuário não são mexidas.
const TEMPLATES = [
  { id: 'parede-min', name: 'Parede minimalista', desc: 'A4 · só a grade · sem encadernação',
    settings: { size: 'a4p', style: 'sografe', palette: 'esmeralda', binding: 'none', showCover: true } },
  { id: 'parede-fotos', name: 'Parede com fotos', desc: 'A4 · foto no topo · wire-o no topo, pronta pra pendurar',
    settings: { size: 'a4p', style: 'fototopo', palette: 'esmeralda', binding: 'wireoTop', showPunch: true, showCover: true } },
  { id: 'poster', name: 'Pôster A3', desc: 'A3 grande · moldura decorativa · wire-o no topo',
    settings: { size: 'a3p', style: 'moldura', palette: 'floresta', binding: 'wireoTop', showPunch: true, showCover: true } },
  { id: 'quadrado', name: 'Quadrado para redes', desc: 'formato 1:1 · foto de fundo · sem capa',
    settings: { size: 'square', style: 'fotofundo', palette: 'sepia', binding: 'none', showCover: false } },
  { id: 'mesa-exec', name: 'Mesa executiva', desc: 'A6 paisagem · foto ao lado · wire-o lateral, folheia como bloco',
    settings: { size: 'a6l', style: 'fotolado', palette: 'grafite', binding: 'wireoLeft', showPunch: true, showCover: true } },
  { id: 'cavalete', name: 'Mesa cavalete', desc: 'dobra em 2, fica de pé sozinho · foto no canto',
    settings: { size: 'standee', style: 'fotocanto', palette: 'esmeralda', binding: 'none', exportMode: 'real', showCover: false } },
  { id: 'ima', name: 'Ímã de geladeira', desc: 'bem pequeno · só a grade · sem capa',
    settings: { size: 'magnet', style: 'sografe', palette: 'marinho', binding: 'none', showCover: false } },
  { id: 'boho', name: 'Boho com fundo de escamas', desc: 'A4 · capa arco-íris · fundo estampado suave · foto no topo',
    settings: { size: 'a4p', style: 'fototopo', palette: 'sepia', binding: 'wireoTop', showPunch: true, showCover: true, coverStyle: 'boho',
      bg: { kind: 'pattern', pat: 'scallop', c1: '#faf5ea', pc: '#efe0c8', ps: 1.2, pw: 0.8 } } },
  { id: 'confete', name: 'Infantil confete', desc: 'A4 · nome em caligrafia · fundo de confete · só a grade',
    settings: { size: 'a4p', style: 'sografe', palette: 'marinho', binding: 'none', showCover: true, coverStyle: 'script', owner: 'Seu Nome',
      bg: { kind: 'pattern', pat: 'confetti', c1: '#ffffff', pc: '#f2b8a2', ps: 1, pw: 1 } } },
  { id: 'empresa', name: 'Calendário da empresa', desc: 'A4 paisagem · foto ao lado · selo da marca em todas as páginas',
    settings: { size: 'a4l', style: 'fotolado', palette: 'floresta', binding: 'wireoTop', showPunch: true, showCover: true, coverStyle: 'bold', title: 'Sua Empresa',
      wm: { on: true, kind: 'seal', text: 'Sua Empresa', text2: 'desde 2010', pos: 'br', opacity: 0.14, size: 0.6, rot: 0, covers: false } } },
  { id: 'ceu', name: 'Céu em degradê', desc: 'A4 · foto de fundo · degradê azul nas páginas sem foto',
    settings: { size: 'a4p', style: 'fotofundo', palette: 'marinho', binding: 'none', showCover: true, coverStyle: 'fullphoto',
      bg: { kind: 'gradient', c1: '#eaf4fb', c2: '#b9d6ee', angle: 180 } } },
  { id: 'editorial-pb', name: 'Preto e branco editorial', desc: 'A4 paisagem · foto no canto · sem capa',
    settings: { size: 'a4l', style: 'fotocanto', palette: 'pb', binding: 'corner', showCover: false } },
];
