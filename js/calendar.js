/* Calendar Studio — js/calendar.js
   Estado do documento, migração/validação, geração das páginas (capa + 12
   meses) e o desenho de cada uma — a MESMA rotina serve a tela (SvgPen) e o
   PDF vetorial (PdfPen). Datas e feriados vêm de vendor/core/dates.js
   (EPDates); a estimativa de anel de vendor/core/binding.js (EPBinding).
   (parte de app; carregado em ordem por index.html, depois de pen.js) */
"use strict";

const KEY = 'calendarstudio-v1';

let state = null;
let currentPage = 0;
let zoom = 0.5, userZoomed = false;
const stage = $('#stage'), sheetsEl = $('#sheets');

function normPhotoEdit(v) {
  if (!v || typeof v !== 'object') return null;
  return (typeof EPImgEdit !== 'undefined' && EPImgEdit.normEdit) ? EPImgEdit.normEdit(v) : null;
}

/* ================= estado / migração ================= */
function newState() {
  return { schema: 1, onboarded: false, settings: { ...DEFAULTS }, months: Array.from({ length: 12 }, emptyMonth) };
}
function calCleanEl(src, re) {
  const out = {};
  if (!src || typeof src !== 'object') return out;
  Object.keys(src).slice(0, 30).forEach(k => {
    if (!re.test(k)) return;
    const e = src[k] && typeof src[k] === 'object' ? src[k] : {}, v = {};
    ['dx', 'dy'].forEach(q => { if (e[q] != null && isFinite(+e[q])) v[q] = clamp(+e[q], -800, 800); });
    if (e.s != null && isFinite(+e.s)) v.s = clamp(+e.s, 0.25, 5);
    if (HEX.test(e.color || '')) v.color = e.color;
    if (typeof e.fam === 'string' && /^[A-Za-z]{2,24}$/.test(e.fam)) v.fam = e.fam;
    if (e.bold != null) v.bold = !!e.bold;
    if (e.hide) v.hide = true;
    out[k] = v;
  });
  return out;
}
function migrate(raw) {
  const src = (raw && typeof raw === 'object') ? raw : {};
  const ds = (src.settings && typeof src.settings === 'object') ? src.settings : {};
  const ufOk = typeof ds.uf === 'string' && EPDates.UFS.indexOf(ds.uf.toUpperCase()) >= 0;
  const sizeKey = SIZES[ds.size] ? ds.size : DEFAULTS.size;
  const isStand = !!(SIZES[sizeKey] && SIZES[sizeKey].stand);
  const settings = {
    year: clamp(Math.round(num(ds.year, DEFAULTS.year)), 1900, 2200),
    weekStart: ds.weekStart === 'sun' ? 'sun' : 'mon',
    uf: ufOk ? ds.uf.toUpperCase() : '',
    holNacional: ds.holNacional !== false,
    holFacultativo: !!ds.holFacultativo,
    holComemorativa: !!ds.holComemorativa,
    events: sanitizeText(ds.events, 8000),
    palette: PALETTES[ds.palette] ? ds.palette : DEFAULTS.palette,
    ink: hexOr(ds.ink, DEFAULTS.ink),
    accent: hexOr(ds.accent, DEFAULTS.accent),
    paperBg: hexOr(ds.paperBg, DEFAULTS.paperBg),
    size: sizeKey,
    style: MONTH_STYLES[ds.style] ? ds.style : DEFAULTS.style,
    title: sanitizeText(ds.title, 60).trim() || DEFAULTS.title,
    owner: sanitizeText(ds.owner, 60),
    showCover: ds.showCover !== false,
    coverPhoto: validImageSrc(ds.coverPhoto) ? ds.coverPhoto : '',
    coverPhotoSrc: validImageSrc(ds.coverPhotoSrc) ? ds.coverPhotoSrc : '',
    coverPhotoEdit: normPhotoEdit(ds.coverPhotoEdit),
    bindGsm: clamp(Math.round(num(ds.bindGsm, DEFAULTS.bindGsm)), 30, 400),
    bindKind: ['offset', 'polen', 'couche', 'reciclado'].indexOf(ds.bindKind) >= 0 ? ds.bindKind : DEFAULTS.bindKind,
    binding: BINDING_TYPES[ds.binding] ? ds.binding : DEFAULTS.binding,
    showPunch: !!ds.showPunch,
    printPunch: !!ds.printPunch,
    // mesa cavalete só sai em tamanho real — "fit" (centralizar numa folha
    // maior + corte) não faz sentido pra uma folha que já vai dobrar ao meio.
    // 'auto' (padrão) decide real/fit sozinho na hora de exportar/imprimir,
    // conforme o tamanho — ver effectiveExportMode().
    exportMode: isStand ? 'real' : (['auto', 'real', 'fit'].indexOf(ds.exportMode) >= 0 ? ds.exportMode : DEFAULTS.exportMode),
    sheet: ds.sheet === 'a3' ? 'a3' : 'a4',
    exportDPI: clamp(Math.round(num(ds.exportDPI, DEFAULTS.exportDPI)), 150, 600),
    startMonth: clamp(Math.round(num(ds.startMonth, 1)), 1, 12),
    showMoon: !!ds.showMoon,
    showWeekNum: !!ds.showWeekNum,
    bleedMm: clamp(num(ds.bleedMm, 0), 0, 10),
    cropMarks: ds.cropMarks !== false,
    pdfColor: ds.pdfColor === 'cmyk' ? 'cmyk' : 'rgb',
    inkSave: clamp(Math.round(num(ds.inkSave, 0)), 0, 60),
    el: calCleanEl(ds.el, /^(title|sub|year|owner|orn)$/),
    coverStyle: COVER_STYLES_CAL[ds.coverStyle] ? ds.coverStyle : 'auto',
    elMonth: calCleanEl(ds.elMonth, /^(mname|myear|caption)$/),
    acrylic: ds.acrylic !== false,
    extras: calCleanExtras(ds.extras),
  };
  const mIn = Array.isArray(src.months) ? src.months : [];
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = (mIn[i] && typeof mIn[i] === 'object') ? mIn[i] : {};
    return {
      photo: validImageSrc(m.photo) ? m.photo : '',
      photoSrc: validImageSrc(m.photoSrc) ? m.photoSrc : '',
      photoEdit: normPhotoEdit(m.photoEdit),
      caption: sanitizeText(m.caption, 120),
      extras: calCleanExtras(m.extras),
    };
  });
  // um state migrado sempre já existia antes (sessão anterior ou projeto
  // importado) — não faz sentido mostrar a tela de início de novo.
  return { schema: 1, onboarded: src.onboarded !== false, settings, months };
}

/* ================= persistência =================
   O documento (textos/ajustes) vai para o localStorage; as FOTOS vão para o
   IndexedDB do navegador. O localStorage aguenta ~5 MB no total — com fotos
   em qualidade de impressão (até ~3600 px) não cabia nem um calendário. No
   JSON do localStorage cada foto vira só o marcador '#idb'. */
const IDB_NAME = 'calendarstudio', IDB_STORE = 'photos', IDB_MARK = '#idb';
let _idbP = null;
function idbOpen() {
  if (_idbP) return _idbP;
  _idbP = new Promise((res, rej) => {
    if (typeof indexedDB === 'undefined') { rej(new Error('sem IndexedDB')); return; }
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(IDB_STORE)) r.result.createObjectStore(IDB_STORE); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return _idbP;
}
function idbTx(mode, fn) {
  return idbOpen().then(db => new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, mode), st = tx.objectStore(IDB_STORE);
    const out = fn(st);
    tx.oncomplete = () => res(out); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
  }));
}
// campos de foto do documento: [chave no IDB, getter, setter]
function photoSlots(st) {
  const s = st.settings, out = [];
  ['coverPhoto', 'coverPhotoSrc'].forEach(k => out.push([k, () => s[k], v => { s[k] = v; }]));
  st.months.forEach((mo, i) => ['photo', 'photoSrc'].forEach(k => out.push([`m${i}.${k}`, () => mo[k], v => { mo[k] = v; }])));
  return out;
}
const _idbSaved = new Map();          // chave -> valor já gravado (evita regravar foto igual)
let saveT, _saveWarned = false, _idbOk = true;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    const puts = [], dels = [];
    const light = JSON.parse(JSON.stringify(state, (k, v) => (typeof v === 'string' && v.length > 512 && v.startsWith('data:')) ? IDB_MARK : v));
    if (_idbOk) {
      photoSlots(state).forEach(([key, get]) => {
        const v = get() || '';
        if ((_idbSaved.get(key) || '') === v) return;
        if (v) puts.push([key, v]); else dels.push(key);
      });
      light.photosInIdb = true;
    }
    const writeLS = () => {
      try { localStorage.setItem(KEY, JSON.stringify(_idbOk ? light : state)); _saveWarned = false; }
      catch (e) {
        if (!_saveWarned) { _saveWarned = true; try { toast('Não coube no armazenamento do navegador. Use "Salvar projeto" no menu para não perder.'); } catch (_) {} }
      }
    };
    if (!_idbOk || (!puts.length && !dels.length)) { writeLS(); return; }
    idbTx('readwrite', st => { puts.forEach(([k, v]) => st.put(v, k)); dels.forEach(k => st.delete(k)); })
      .then(() => { puts.forEach(([k, v]) => _idbSaved.set(k, v)); dels.forEach(k => _idbSaved.set(k, '')); writeLS(); })
      .catch(err => { console.warn('IndexedDB indisponível, usando só localStorage', err); _idbOk = false; writeLS(); });
  }, 300);
}
function load() {
  let d; try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  state = (d && typeof d === 'object') ? migrate(d) : newState();
  if (!(d && d.photosInIdb)) return;
  // quais campos tinham foto guardada no IndexedDB
  const want = [];
  const ds = d.settings || {};
  ['coverPhoto', 'coverPhotoSrc'].forEach(k => { if (ds[k] === IDB_MARK) want.push(k); });
  (Array.isArray(d.months) ? d.months : []).forEach((mo, i) => ['photo', 'photoSrc'].forEach(k => { if (mo && mo[k] === IDB_MARK) want.push(`m${i}.${k}`); }));
  if (!want.length) return;
  const target = state;
  const got = {};
  idbTx('readonly', st => { want.forEach(k => { const r = st.get(k); r.onsuccess = () => { got[k] = r.result; }; }); })
    .then(() => {
      if (state !== target) return;   // documento já foi trocado nesse meio-tempo
      let n = 0;
      photoSlots(state).forEach(([key, get, set]) => {
        const v = got[key];
        if (typeof v === 'string' && validImageSrc(v) && !get()) { set(v); _idbSaved.set(key, v); n++; }
      });
      if (n) { try { render(); } catch (e) {} document.dispatchEvent(new CustomEvent('photos-restored')); }
    })
    .catch(err => console.warn('não consegui ler as fotos salvas', err));
}

/* ================= geometria ================= */
function paperWH() { const p = SIZES[state.settings.size] || SIZES.a4p; return [p.w, p.h]; }

// decide sozinho a montagem de saída (real | fit) quando settings.exportMode
// === 'auto' (padrão): se o tamanho já É uma folha A4 inteira, tamanho real
// (nada pra cortar); se CABE dentro de uma A4, centraliza numa A4 com
// marcas de corte — pronto pra imprimir em casa/escritório e cortar; do
// contrário (maior que A4 — ex. o pôster A3), tamanho real mesmo (gráfica).
// Mesa cavalete é sempre 'real' (já tem o próprio modo de dobra).
function fitsWithinA4(w, h) { return (w <= 210.5 && h <= 297.5) || (w <= 297.5 && h <= 210.5); }
function isFullSheet(w, h, sw, sh) { return (Math.abs(w - sw) < 0.5 && Math.abs(h - sh) < 0.5) || (Math.abs(w - sh) < 0.5 && Math.abs(h - sw) < 0.5); }
function effectiveExportMode() {
  const s = state.settings;
  if (SIZES[s.size] && SIZES[s.size].stand) return { mode: 'real', sheet: s.sheet, auto: true };
  if (s.exportMode !== 'auto') return { mode: s.exportMode, sheet: s.sheet, auto: false };
  const [W, H] = paperWH();
  if (isFullSheet(W, H, 210, 297)) return { mode: 'real', sheet: s.sheet, auto: true };
  if (fitsWithinA4(W, H)) return { mode: 'fit', sheet: 'a4', auto: true };
  return { mode: 'real', sheet: s.sheet, auto: true };
}

/* ================= páginas ================= */
// os 12 meses do calendário: a partir de startMonth (ano letivo ago–jul etc.)
function spanMonths(s = state.settings) {
  return Array.from({ length: 12 }, (_, k) => { const d = new Date(s.year, s.startMonth - 1 + k, 1); return { m: d.getMonth() + 1, y: d.getFullYear() }; });
}
function spanLabel(s = state.settings) {
  const sp = spanMonths(s), a = sp[0], b = sp[11];
  return a.y === b.y ? String(a.y) : `${MONTHS_SHORT[a.m - 1].toLowerCase()} ${a.y} – ${MONTHS_SHORT[b.m - 1].toLowerCase()} ${b.y}`;
}
function expand() {
  const s = state.settings, size = SIZES[s.size] || {};
  const pages = [];
  if (size.layout === 'year') {
    if (size.pocket) pages.push({ kind: 'cover' });
    pages.push({ kind: 'year', from: 0, count: 12 });
    return pages;
  }
  if (s.showCover) pages.push({ kind: 'cover' });
  if (size.layout === 'half') { pages.push({ kind: 'year', from: 0, count: 6 }, { kind: 'year', from: 6, count: 6 }); return pages; }
  spanMonths(s).forEach(({ m, y }) => pages.push({ kind: 'month', m, y }));
  return pages;
}
function pageCount() { return expand().length; }
function curPage() { return expand()[clamp(currentPage, 0, pageCount() - 1)] || null; }

/* ================= feriados / eventos ================= */
let _holCache = null, _holSig = '';
// feriados do ano anterior ao seguinte (calendário de ano letivo cruza a virada)
function holidayIndex() {
  const s = state.settings;
  const sig = s.year + '|' + s.uf + '|' + s.holNacional + '|' + s.holFacultativo + '|' + s.holComemorativa;
  if (_holCache && _holSig === sig) return _holCache;
  const map = Object.create(null);
  for (let y = s.year - 1; y <= s.year + 1; y++) {
    let list = EPDates.holidaysForYear(y, { uf: s.uf || null, includeOptional: s.holFacultativo, includeCommemorative: s.holComemorativa });
    if (!s.holNacional) list = list.filter(h => h.type !== 'nacional');
    list.forEach(h => { (map[h.ymd] || (map[h.ymd] = [])).push(h.name); });
  }
  _holCache = map; _holSig = sig;
  return map;
}
// fases da lua por data (fuso de Brasília)
let _moonCache = null, _moonSig = '';
function moonIndex() {
  const s = state.settings, sig = s.year + '';
  if (_moonCache && _moonSig === sig) return _moonCache;
  const map = Object.create(null);
  EPDates.moonPhases(new Date(s.year - 1, 11, 1), new Date(s.year + 1, 11, 31)).forEach(p => { map[p.ymd] = p.phase; });
  _moonCache = map; _moonSig = sig;
  return map;
}
// símbolo da fase — como vista do hemisfério sul (Brasil): crescente iluminada à esquerda.
// Convenção de calendário: parte escura preenchida.
function drawMoon(pen, cx, cy, r, phase, col) {
  const st = { stroke: col, w: Math.max(0.12, r * 0.14) };
  if (phase === 0) { pen.circle(cx, cy, r, { fill: col }); return; }
  pen.circle(cx, cy, r, st);
  if (phase === 2) return;
  const side = phase === 1 ? 1 : -1;              // escuro à direita no crescente, à esquerda no minguante
  const pts = [];
  for (let i = 0; i <= 16; i++) { const a = -Math.PI / 2 + Math.PI * i / 16; pts.push([cx + side * r * Math.cos(a), cy + r * Math.sin(a)]); }
  pen.poly(pts, { fill: col });
}
let _evCache = null, _evSig = '';
function eventIndex() {
  const s = state.settings;
  if (_evCache && _evSig === s.events) return _evCache;
  _evCache = EPDates.indexEvents(EPDates.parseEvents(s.events, 1000));
  _evSig = s.events;
  return _evCache;
}
function markOn(date) {
  const ymd = EPDates.dateToYmd(date);
  const hol = holidayIndex()[ymd];
  const ev = eventIndex().on(date);
  const all = [].concat(hol || [], ev || []);
  return all.length ? all.join(' · ') : null;
}

/* ================= encadernação (reserva de margem + guia de furo) =================
   Aplicado à página INTEIRA (capa e meses) antes de calcular qualquer layout
   — assim nada desenhado pelo app entra na faixa onde o furo vai ser feito. */
function bindMargin(b) { return Math.max(b.marginMm || 0, b.spec ? EPPrint.bindingMargin(b.spec) : 0); }
function contentInset(box, bindingKey) {
  const b0 = BINDING_TYPES[bindingKey] || BINDING_TYPES.none;
  if (!b0.edge || !b0.marginMm) return { box, strip: null };
  const b = { edge: b0.edge, marginMm: bindMargin(b0) };
  if (b.edge === 'top') {
    return {
      box: { x: box.x, y: box.y + b.marginMm, w: box.w, h: box.h - b.marginMm },
      strip: { x: box.x, y: box.y, w: box.w, h: b.marginMm },
    };
  }
  return {
    box: { x: box.x + b.marginMm, y: box.y, w: box.w - b.marginMm, h: box.h },
    strip: { x: box.x, y: box.y, w: b.marginMm, h: box.h },
  };
}
// guia de furo — tracejada, só decorativa (não é a arte final). Tela: se
// `showPunch`; PDF/impressão: só se `printPunch` (produção real costuma furar
// na gráfica, sem precisar do círculo impresso).
function drawPunchGuide(pen, strip, bindingKey, opts) {
  const b = BINDING_TYPES[bindingKey];
  if (!b || !b.edge || !strip) return;
  const wantScreen = opts && opts.screen && state.settings.showPunch;
  const wantPrint = !(opts && opts.screen) && state.settings.printPunch;
  if (!wantScreen && !wantPrint) return;
  const col = '#b23b2c';
  const boundary = { w: 0.2, color: col, dash: [1.4, 1.4] };
  const holeS = { stroke: col, w: 0.25 };
  // furos na medida da máquina, fileira centralizada; wire-o de parede deixa o
  // vão central do gancho (meia-lua de 12 mm) sem furos.
  const hole = (cx, cy, h) => h.shape === 'rect' ? pen.rect(cx - h.w / 2, cy - h.h / 2, h.w, h.h, holeS) : pen.circle(cx, cy, h.r, holeS);
  if (b.edge === 'top') {
    const holes = EPPrint.holes(b.spec, strip.w), mid = strip.x + strip.w / 2;
    holes.forEach(h => { const x = strip.x + h.t; if (b.hanger && Math.abs(x - mid) < 16) return; hole(x, strip.y + h.edge, h); });
    if (b.hanger) {
      const pts = []; for (let i = 0; i <= 16; i++) { const a = Math.PI * i / 16; pts.push([mid + 6 * Math.cos(a), strip.y + 6 * Math.sin(a)]); }
      pen.poly(pts, { stroke: col, w: 0.25, close: false });
    }
    pen.line(strip.x, strip.y + strip.h, strip.x + strip.w, strip.y + strip.h, boundary);
  } else {
    EPPrint.holes(b.spec, strip.h).forEach(h => hole(strip.x + h.edge, strip.y + h.t, h));
    pen.line(strip.x + strip.w, strip.y, strip.x + strip.w, strip.y + strip.h, boundary);
  }
}
// painel de apoio da mesa cavalete (metade de baixo da folha, dobra ao meio).
function drawStandBase(pen, box, s) {
  pen.rect(box.x, box.y, box.w, box.h, { fill: s.paperBg });
  pen.rect(box.x + 4, box.y + 4, box.w - 8, box.h - 8, { stroke: mixHex(s.ink, s.paperBg, 0.85), w: 0.3 });
  const cy = box.y + box.h / 2;
  pen.text('Esmeralda Paper', box.x + box.w / 2, cy - 2, { size: 9, family: 'serif', font: 'bold', color: mixHex(s.ink, s.paperBg, 0.55), align: 'c', baseline: 'middle' });
  pen.text('dobre e cole esta base', box.x + box.w / 2, cy + 6, { size: 6.5, family: 'sans', color: mixHex(s.ink, s.paperBg, 0.55), align: 'c', baseline: 'middle' });
}

/* edição na folha (calFx/calText) e capa: js/cal-cover.js · ilustrações e elementos livres: js/cal-decor.js */

/* ================= sangria =================
   Durante o desenho de uma página com sangria, fundos e fotos que encostam na
   borda da página avançam `b` mm para fora — o refile da gráfica não deixa
   filete branco. */
let BLEED = { b: 0, W: 0, H: 0 };
function ext(r) {
  const { b, W, H } = BLEED;
  if (!b || !r) return r;
  const t = 0.05, x0 = r.x <= t ? r.x - b : r.x, y0 = r.y <= t ? r.y - b : r.y;
  const x1 = r.x + r.w >= W - t ? r.x + r.w + b : r.x + r.w, y1 = r.y + r.h >= H - t ? r.y + r.h + b : r.y + r.h;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/* ================= cor ================= */
function hx(c) { c = HEX.test(c) ? c : '#000000'; if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function mixHex(a, b, t) { const A = hx(a), B = hx(b); return '#' + [0, 1, 2].map(i => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join(''); }

/* ================= desenho ================= */
// escala tipográfica: 1 = página de ~190 mm de largura útil (A4 retrato).
// Sem isso o pôster A3 saía com letra de A4 e o ímã com letra estourando.
const typeK = box => clamp(Math.min(box.w, box.h * 1.25) / 190, 0.5, 2.2);
const MONTH_NUM = m => String(m).padStart(2, '0');

// área de foto vazia: em vez de um buraco em branco no papel, um bloco de cor
// suave com o número do mês — a página continua com cara de pronta. Na tela,
// um aviso discreto de onde clicar.
function drawPhotoPlaceholder(pen, r, s, m, opts, big) {
  pen.rect(r.x, r.y, r.w, r.h, { fill: mixHex(s.accent, s.paperBg, 0.86) });
  const label = m ? MONTH_NUM(m) : String(s.year);
  const size = clamp(Math.min(r.h * 0.62, r.w * (m ? 0.42 : 0.3)) * PT, 10, big ? 260 : 150);
  pen.text(label, r.x + r.w / 2, r.y + r.h / 2, { size, font: 'bold', family: 'serif', color: mixHex(s.accent, s.paperBg, 0.62), align: 'c', baseline: 'middle' });
  if (opts && opts.screen && r.h > 24 && r.w > 30) {
    pen.text('+ foto', r.x + r.w / 2, r.y + r.h - Math.min(8, r.h * 0.12), { size: clamp(r.w * 0.05 * PT, 7, 14), color: mixHex(s.ink, s.paperBg, 0.45), align: 'c', baseline: 'middle' });
  }
}

function monthLayout(style, box) {
  const k = typeK(box);
  const pad = clamp(Math.min(box.w, box.h) * 0.04, 5, 14);
  const x = box.x + pad, y = box.y + pad, w = box.w - 2 * pad, h = box.h - 2 * pad;
  const headH = 15 * k, gap = 6 * k;
  if (style === 'sografe') {
    const hh = Math.min(22 * k, h * 0.14);
    return { photo: null, head: { x, y, w, h: hh }, grid: { x, y: y + hh + gap, w, h: h - hh - gap } };
  }
  if (style === 'fotolado') {
    const pw = w * 0.36;
    return { photo: { x, y, w: pw, h }, head: { x: x + pw + gap, y, w: w - pw - gap, h: headH }, grid: { x: x + pw + gap, y: y + headH + gap, w: w - pw - gap, h: h - headH - gap } };
  }
  if (style === 'fotofundo') {
    const panelTop = y + h * 0.4;
    return {
      photoFull: box,
      panel: { x: box.x, y: panelTop - 4 * k, w: box.w, h: (box.y + box.h) - (panelTop - 4 * k) },
      head: { x, y: panelTop + 4 * k, w, h: headH },
      grid: { x, y: panelTop + 4 * k + headH + gap, w, h: (box.y + box.h - pad) - (panelTop + 4 * k + headH + gap) },
    };
  }
  if (style === 'moldura') {
    const cardW = w * 0.86, cardH = h * 0.52;
    const cx = x + (w - cardW) / 2, cy = box.y + box.h - pad * 1.6 - cardH;
    const ip = 7 * k;
    return {
      photoFull: box,
      card: { x: cx, y: cy, w: cardW, h: cardH },
      head: { x: cx + ip, y: cy + ip, w: cardW - 2 * ip, h: headH },
      grid: { x: cx + ip, y: cy + ip + headH + gap, w: cardW - 2 * ip, h: cardH - 2 * ip - headH - gap },
    };
  }
  if (style === 'fotocanto') {
    const thumb = clamp(Math.min(w * 0.22, h * 0.17), 18, 80);
    return {
      photoThumb: { x, y, w: thumb, h: thumb },
      head: { x: x + thumb + gap, y, w: w - thumb - gap, h: thumb },
      grid: { x, y: y + thumb + gap * 1.4, w, h: h - thumb - gap * 1.4 },
    };
  }
  // fototopo (padrão)
  const ph = h * 0.48;
  return { photo: { x, y, w, h: ph }, head: { x, y: y + ph + gap, w, h: headH }, grid: { x, y: y + ph + gap + headH + gap * 0.6, w, h: h - ph - gap * 1.6 - headH } };
}

function drawMonthHead(pen, r, s, m, caption) {
  const k = clamp(r.w / 190, 0.45, 2.2);
  const name = EPDates.MONTHS_PT[m - 1];
  const nameSize = clamp(Math.min(r.h * 0.95 * PT, 26 * k), 9, 60);
  calText(pen, 'mname', 'Nome do mês', name, r.x, r.y + r.h * 0.45, { size: nameSize, family: 'serif', color: s.ink, align: 'l', baseline: 'middle' });
  const nameW = pen.textWidth(name, nameSize, false, 'serif');
  calText(pen, 'myear', 'Ano do mês', String(s.year), r.x + r.w, r.y + r.h * 0.45, { size: clamp(nameSize * 0.42, 6, 20), family: 'sans', color: s.accent, align: 'r', baseline: 'middle', font: 'bold', tracking: 0.6 * k });
  if (caption) {
    const txt = EPDates.applyVars(caption, { date: new Date(s.year, m - 1, 1), year: s.year });
    if (txt) {
      const cs = clamp(nameSize * 0.38, 6, 16);
      const room = r.w - nameW - pen.textWidth(String(s.year), nameSize * 0.42, true, 'sans') - 12 * k;
      const fc = calFx('caption'), roomK = fc.dx || fc.dy || fc.s !== 1 ? r.w : room;
      if (roomK > 20) calText(pen, 'caption', 'Legenda', pen.wrapText(txt, roomK, cs, false, 1, 'serif')[0] || '', r.x + nameW + 5 * k, r.y + r.h * 0.5, { size: cs, family: 'serif', color: mixHex(s.ink, s.paperBg, 0.4), align: 'l', baseline: 'middle', font: 'it' });
    }
  }
}

function drawMonthGrid(pen, r, s, m) {
  const year = s.year, weekStart = s.weekStart;
  const order = weekStart === 'sun' ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0];
  const DOW3 = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'], DOW1 = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const first = new Date(year, m - 1, 1);
  const startCol = order.indexOf(first.getDay());
  const dim = EPDates.daysInMonth(year, m);
  const rows = Math.ceil((startCol + dim) / 7);
  // número da semana ISO 8601 numa coluna estreita à esquerda (opcional)
  if (s.showWeekNum) {
    const wc = Math.min(r.w * 0.06, 9);
    r = { x: r.x + wc, y: r.y, w: r.w - wc, h: r.h };
    r.weekCol = wc;
  }
  const cw = r.w / 7;
  const headH = clamp(r.h * 0.07, 4, 12 * clamp(r.w / 190, 0.6, 2));
  const rh = (r.h - headH) / rows;
  const k = clamp(Math.min(cw / 27, rh / 22), 0.4, 2.4);
  const gridLine = mixHex(s.ink, s.paperBg, 0.84);
  const wkTint = mixHex(s.accent, s.paperBg, 0.93);
  const faint = mixHex(s.ink, s.paperBg, 0.72);
  const useLong = cw > 14;
  for (let c = 0; c < 7; c++) {
    const dow = order[c];
    pen.text(useLong ? DOW3[dow] : DOW1[dow], r.x + c * cw + cw / 2, r.y + headH / 2, { size: clamp(headH * 0.5 * PT * 0.9, 4, 12), font: 'bold', color: (dow === 0 || dow === 6) ? s.accent : mixHex(s.ink, s.paperBg, 0.35), align: 'c', baseline: 'middle', family: 'sans', tracking: useLong ? 0.25 * k : 0 });
  }
  const y0 = r.y + headH;
  // fins de semana com fundo levíssimo
  for (let c = 0; c < 7; c++) if (order[c] === 0 || order[c] === 6) pen.rect(r.x + c * cw, y0, cw, rh * rows, { fill: wkTint });
  // linhas da grade (horizontais + verticais) — mais limpo que um retângulo por dia
  for (let rr = 0; rr <= rows; rr++) pen.line(r.x, y0 + rr * rh, r.x + r.w, y0 + rr * rh, { w: rr === 0 ? 0.45 : 0.22, color: rr === 0 ? mixHex(s.ink, s.paperBg, 0.55) : gridLine });
  for (let c = 1; c < 7; c++) pen.line(r.x + c * cw, y0, r.x + c * cw, y0 + rows * rh, { w: 0.22, color: gridLine });
  const numSize = clamp(Math.min(rh * 0.3, cw * 0.36) * PT, 4.5, 26);
  const npad = clamp(cw * 0.07, 0.8, 4);
  // dias do mês anterior/seguinte, bem apagados, completando a grade
  const prevDim = EPDates.daysInMonth(m === 1 ? year - 1 : year, m === 1 ? 12 : m - 1);
  for (let i = 0; i < startCol; i++) {
    pen.text(String(prevDim - startCol + 1 + i), r.x + i * cw + npad, y0 + npad, { size: numSize * 0.8, color: faint, baseline: 'top' });
  }
  for (let i = startCol + dim, d = 1; i < rows * 7; i++, d++) {
    pen.text(String(d), r.x + (i % 7) * cw + npad, y0 + Math.floor(i / 7) * rh + npad, { size: numSize * 0.8, color: faint, baseline: 'top' });
  }
  if (r.weekCol) {
    const ws = clamp(Math.min(rh * 0.2, r.weekCol * 0.5) * PT, 3.5, 11);
    for (let rr = 0; rr < rows; rr++) {
      // semana da linha = semana ISO da quinta-feira daquela linha
      const d0 = new Date(year, m - 1, 1 - startCol + rr * 7);
      const thu = new Date(d0); thu.setDate(d0.getDate() + ((4 - d0.getDay() + 7) % 7));
      pen.text(String(EPDates.isoWeek(thu)), r.x - r.weekCol / 2, y0 + rr * rh + npad, { size: ws, color: faint, align: 'c', baseline: 'top', family: 'sans' });
    }
  }
  const moons = s.showMoon ? moonIndex() : null;
  for (let day = 1; day <= dim; day++) {
    const idx = startCol + day - 1, rr = Math.floor(idx / 7), cc = idx % 7;
    const cx = r.x + cc * cw, cy = y0 + rr * rh;
    const dt = new Date(year, m - 1, day);
    const dow = dt.getDay();
    const mark = markOn(dt);
    const numColor = mark ? s.accent : (dow === 0 || dow === 6 ? mixHex(s.ink, s.paperBg, 0.25) : s.ink);
    pen.text(String(day), cx + npad, cy + npad, { size: numSize, color: numColor, font: mark ? 'bold' : undefined, baseline: 'top' });
    let dotY = cy + npad + 0.8;
    if (moons) {
      const ph = moons[EPDates.dateToYmd(dt)];
      if (ph != null) {
        const mr = clamp(Math.min(cw, rh) * 0.075, 0.7, 3.2);
        drawMoon(pen, cx + cw - npad - mr, cy + npad + mr, mr, ph, mixHex(s.ink, s.paperBg, 0.3));
        dotY += 2 * mr + 0.8;
      }
    }
    if (mark) {
      const ms = clamp(numSize * 0.5, 3.6, 10);
      const lh = ms * 1.15 / PT;
      if (rh > numSize / PT + lh * 1.6) {
        const lines = pen.wrapText(mark, cw - 2 * npad, ms, false, 2, 'sans');
        let ly = cy + rh - npad - lines.length * lh;
        lines.forEach(line => { if (line) { pen.text(line, cx + npad, ly, { size: ms, color: s.accent, baseline: 'top' }); ly += lh; } });
      } else {
        pen.dot(cx + cw - npad - 0.8, dotY, 0.7, { fill: s.accent });
      }
    }
  }
}

function drawMonthPage(pen, box, s, m, opts) {
  const L = monthLayout(s.style, box);
  const mo = (state.months && state.months[m - 1]) || emptyMonth();
  const has = !!(mo.photo && pen.image);
  if (s.style === 'fotofundo' || s.style === 'moldura') {
    const pf = ext(L.photoFull);
    calHit('photo', 'Foto do mês', 'photo', L.photoFull.x, L.photoFull.y, L.photoFull.w, L.photoFull.h);
    if (has) pen.image(mo.photo, pf.x, pf.y, pf.w, pf.h, { fit: 'cover' });
    else drawPhotoPlaceholder(pen, ext(s.style === 'moldura' ? L.photoFull : { x: box.x, y: box.y, w: box.w, h: L.panel.y - box.y }), s, m, opts, true);
    if (s.style === 'moldura') {
      const k = typeK(box);
      pen.rect(box.x + 5 * k, box.y + 5 * k, box.w - 10 * k, box.h - 10 * k, { stroke: has ? s.paperBg : s.accent, w: 0.6 * k });
      pen.rect(L.card.x, L.card.y, L.card.w, L.card.h, { fill: s.paperBg, fillOpacity: has ? 0.94 : 1, rx: 2 * k });
    } else {
      const pn = ext(L.panel);
      pen.rect(pn.x, pn.y, pn.w, pn.h, { fill: s.paperBg, fillOpacity: has ? 0.92 : 1 });
    }
  } else if (s.style === 'fotocanto') {
    { const e = ext(box); pen.rect(e.x, e.y, e.w, e.h, { fill: s.paperBg }); }
    calHit('photo', 'Foto do mês', 'photo', L.photoThumb.x, L.photoThumb.y, L.photoThumb.w, L.photoThumb.h);
    if (has) pen.image(mo.photo, L.photoThumb.x, L.photoThumb.y, L.photoThumb.w, L.photoThumb.h, { fit: 'cover' });
    else drawPhotoPlaceholder(pen, L.photoThumb, s, m, null, false);
  } else {
    { const e = ext(box); pen.rect(e.x, e.y, e.w, e.h, { fill: s.paperBg }); }
    if (L.photo) {
      calHit('photo', 'Foto do mês', 'photo', L.photo.x, L.photo.y, L.photo.w, L.photo.h);
      if (has) pen.image(mo.photo, L.photo.x, L.photo.y, L.photo.w, L.photo.h, { fit: 'cover' });
      else drawPhotoPlaceholder(pen, L.photo, s, m, opts, true);
    }
  }
  drawMonthHead(pen, L.head, s, m, mo.caption);
  drawMonthGrid(pen, L.grid, s, m);
}

// página com vários meses (pôster anual, econômico, verso do bolso)
function drawYearPage(pen, box, s, pd, opts) {
  const k = typeK(box), small = Math.min(box.w, box.h) < 110;
  const pad = clamp(Math.min(box.w, box.h) * 0.04, 2.5, 16);
  { const e = ext(box); pen.rect(e.x, e.y, e.w, e.h, { fill: s.paperBg }); }
  let top = box.y + pad;
  const span = spanMonths(s).slice(pd.from, pd.from + pd.count);
  if (!small) {
    const tH = clamp(box.h * 0.06, 10, 40);
    const title = s.title || 'Calendário';
    const tSize = pen.fitText(title, box.w * 0.62, tH * PT * 0.8, 9, false, 'serif');
    pen.text(title, box.x + pad, top + tH / 2, { size: tSize, family: 'serif', color: s.ink, baseline: 'middle' });
    const sub = pd.count < 12 ? `${EPDates.MONTHS_PT[span[0].m - 1]} – ${EPDates.MONTHS_PT[span[span.length - 1].m - 1]} ${span[span.length - 1].y}` : spanLabel(s);
    pen.text(sub.toUpperCase(), box.x + box.w - pad, top + tH / 2, { size: clamp(tSize * 0.45, 6, 22), font: 'bold', family: 'sans', color: s.accent, align: 'r', baseline: 'middle', tracking: 0.5 * k });
    pen.line(box.x + pad, top + tH + 1.5 * k, box.x + box.w - pad, top + tH + 1.5 * k, { w: 0.4 * k, color: s.accent });
    top += tH + 5 * k;
  }
  const gw = box.w - 2 * pad, gh = box.y + box.h - pad - top;
  // grade de meses que aproveita melhor o espaço (célula mais parecida com a proporção de um mês)
  let best = null;
  for (let cols = 1; cols <= pd.count; cols++) {
    if (pd.count % cols && cols !== 4 && cols !== 3) continue;
    const rows = Math.ceil(pd.count / cols), cwid = gw / cols, chei = gh / rows;
    const score = Math.min(cwid, chei * 1.05);
    if (!best || score > best.score) best = { cols, rows, score };
  }
  const gapX = clamp(gw * 0.025, 1.5, 12), gapY = gapX;
  const cwid = (gw - gapX * (best.cols - 1)) / best.cols, chei = (gh - gapY * (best.rows - 1)) / best.rows;
  span.forEach(({ m, y }, i) => {
    const c = i % best.cols, rr = Math.floor(i / best.cols);
    const x = box.x + pad + c * (cwid + gapX), yy = top + rr * (chei + gapY);
    const hh = clamp(chei * 0.13, 2.5, 30);
    const ss = y === s.year ? s : { ...s, year: y };
    pen.text(EPDates.MONTHS_PT[m - 1] + (y !== s.year || pd.count === 12 && s.startMonth > 1 && m === 1 ? ' ' + y : ''), x, yy + hh / 2, { size: clamp(hh * 0.62 * PT, 4, 40), family: 'serif', color: s.ink, baseline: 'middle' });
    drawMonthGrid(pen, { x, y: yy + hh + 0.5, w: cwid, h: chei - hh - 0.5 }, ss, m);
  });
}

function drawPageInto(pen, pd, idx, opts = {}) {
  const s = state.settings, [W, H] = paperWH();
  const b = Math.max(0, +opts.bleed || 0);
  BLEED = { b, W, H };
  HITS = opts.hits || null;
  if (!opts.screen) pen.rect(-b, -b, W + 2 * b, H + 2 * b, { fill: s.paperBg });
  const full = { x: 0, y: 0, w: W, h: H };
  const { box, strip } = contentInset(full, s.binding);
  try {
    if (pd.kind === 'cover') drawCover(pen, box, s, opts);
    else if (pd.kind === 'year') drawYearPage(pen, box, s, pd, opts);
    else drawMonthPage(pen, box, pd.y && pd.y !== s.year ? { ...s, year: pd.y } : s, pd.m, opts);
    const extras = calExtrasOf(pd);
    if (extras && extras.length) calDrawExtras(pen, extras, W, H, s);
  } finally { BLEED = { b: 0, W, H }; HITS = null; }
  if (strip) drawPunchGuide(pen, strip, s.binding, opts);
}

function pageSig(idx, pd) {
  const s = state.settings;
  const mo = pd.kind === 'month' ? state.months[pd.m - 1] : null;
  return [idx, pd.kind, pd.m || 0, pd.y || 0, pd.from || 0, mo ? mo.photo.length + '|' + mo.caption + JSON.stringify(mo.extras || []) : JSON.stringify(pd.kind === 'cover' ? s.extras || [] : []),
    s.year, s.startMonth, s.showMoon, s.showWeekNum, s.weekStart, s.uf, s.holNacional, s.holFacultativo, s.holComemorativa, s.events,
    s.ink, s.accent, s.paperBg, s.size, s.style, s.title, s.owner, s.showCover,
    s.coverPhoto.length, s.coverStyle, s.binding, s.showPunch, JSON.stringify(s.el || {}), JSON.stringify(s.elMonth || {})].join('|');
}
function buildSVG(idx, pd) {
  const [W, H] = paperWH();
  const pen = SvgPen(W, H, { bg: state.settings.paperBg });
  drawPageInto(pen, pd, idx, { screen: true });
  return pen.svg();
}

/* ================= render / navegação ================= */
function render() {
  const [W, H] = paperWH();
  const pages = expand();
  currentPage = clamp(currentPage, 0, Math.max(0, pages.length - 1));
  sheetsEl.style.setProperty('--pw', W + 'mm');
  sheetsEl.style.setProperty('--ph', H + 'mm');
  const kids = sheetsEl.children;
  if (kids.length !== pages.length) {
    sheetsEl.innerHTML = '';
    for (let i = 0; i < pages.length; i++) {
      const d = document.createElement('div');
      d.className = 'page'; d.dataset.idx = i;
      d.style.width = W + 'mm'; d.style.height = H + 'mm';
      sheetsEl.appendChild(d);
    }
  }
  for (let i = 0; i < pages.length; i++) {
    const el = sheetsEl.children[i];
    if (el.style.width !== W + 'mm') { el.style.width = W + 'mm'; el.style.height = H + 'mm'; }
    const sig = pageSig(i, pages[i]);
    if (el.dataset.sig !== sig) { el.innerHTML = buildSVG(i, pages[i]); el.dataset.sig = sig; }
    el.classList.toggle('inSel', i === currentPage);
  }
  applyZoom();
  const stat = $('#stat'); if (stat) stat.textContent = `${state.settings.year} · ${pages.length} página(s) · ${W.toFixed(0)}×${H.toFixed(0)} mm`;
  const lbl = $('#pageLbl'); if (lbl) lbl.textContent = `${currentPage + 1} / ${Math.max(1, pages.length)}`;
  const mpg = $('#mpg'); if (mpg) mpg.textContent = pages.length ? `Pág. ${currentPage + 1}/${pages.length}` : '';
  updateHistoryButtons();
  if (typeof fillRight === 'function') fillRight();
  if (typeof renderMonthList === 'function') renderMonthList();
  if (typeof mSync === 'function') mSync();
}
function applyZoom() { sheetsEl.style.zoom = zoom; const z = $('#zval'); if (z) z.textContent = Math.round(zoom * 100) + '%'; }
function fit() {
  const [W, H] = paperWH();
  const cs = getComputedStyle(stage);
  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const zw = (stage.clientWidth - padX - 24) / (W * MM);
  const zh = (stage.clientHeight - padY - 24) / (H * MM);
  zoom = clamp(Math.min(zw, zh * 1.02), .08, 2.4); userZoomed = false; applyZoom();
}
function zoomAt(cx, cy, factor) {
  const z0 = zoom, z1 = clamp(z0 * factor, .08, 3);
  if (z1 === z0) return;
  const r = stage.getBoundingClientRect();
  const px = stage.scrollLeft + (cx - r.left), py = stage.scrollTop + (cy - r.top);
  userZoomed = true; zoom = z1; applyZoom();
  stage.scrollLeft = px * (z1 / z0) - (cx - r.left);
  stage.scrollTop = py * (z1 / z0) - (cy - r.top);
}
function gotoPage(i) {
  const n = pageCount();
  const had = currentPage;
  currentPage = clamp(i, 0, Math.max(0, n - 1));
  render();
  // igual ao Polaroide Studio: tocar numa página com foto abre os ajustes
  // dela no painel direito, mesmo se o painel estava fechado.
  if (currentPage !== had && typeof uiState !== 'undefined' && !uiState.right && !zen && typeof togglePanel === 'function' && !isMobile()) {
    togglePanel('right', true);
  }
  const pg = sheetsEl.children[currentPage];
  // instantâneo (não 'smooth'): evita a rolagem "correr atrás" e o listener de
  // rolagem recalcular currentPage a partir de uma posição intermediária,
  // brigando com a página que acabou de ser escolhida no clique.
  if (pg) pg.scrollIntoView({ block: 'center', behavior: 'auto' });
}

/* ================= histórico ================= */
let past = [], future = [];
// histMeta é paralelo a `past` (mesmo índice/tamanho) — só a hora de cada
// passo, pra desenhar o histórico visual (openHistoryPop) sem duplicar o
// snapshot nem mudar a forma de `past`/`future` que undo()/redo() já usam.
let histMeta = [];
// Cada passo do desfazer é um JSON do documento. Com fotos inline, 40 passos
// eram 40 cópias de todas as fotos na memória; aqui a foto entra uma vez só
// num "pool" e o passo guarda só a referência.
const _pool = new Map(), _poolRev = new Map(); let _poolSeq = 0;
const snap = () => JSON.stringify(state, (k, v) => {
  if (typeof v !== 'string' || v.length < 2048 || !v.startsWith('data:')) return v;
  let id = _pool.get(v); if (!id) { id = '#pool:' + (++_poolSeq); _pool.set(v, id); _poolRev.set(id, v); }
  return id;
});
const unsnap = str => JSON.parse(str, (k, v) => (typeof v === 'string' && _poolRev.has(v)) ? _poolRev.get(v) : v);
function pushHistory() { past.push(snap()); histMeta.push({ t: Date.now() }); if (past.length > 40) { past.shift(); histMeta.shift(); } future.length = 0; updateHistoryButtons(); }
function applySnap(str) { state = migrate(unsnap(str)); render(); save(); }
function undo() { if (!past.length) return; future.push(snap()); applySnap(past.pop()); histMeta.pop(); toast('Desfeito'); }
function redo() { if (!future.length) return; past.push(snap()); histMeta.push({ t: Date.now() }); applySnap(future.pop()); }
// Volta N passos de uma vez (histórico visual) — os passos intermediários
// vão pro `future` na ordem certa, então redo() continua funcionando normal.
function undoTo(n) {
  if (n < 1 || n > past.length) return;
  future.push(snap());
  let target;
  for (let i = 0; i < n; i++) { target = past.pop(); histMeta.pop(); if (i < n - 1) future.push(target); }
  applySnap(target);
  toast(n > 1 ? `Voltou ${n} passos.` : 'Desfeito');
}
function updateHistoryButtons() {
  const set = (id, on) => { const e = $(id); if (e) e.disabled = !on; };
  set('#b_undo', past.length); set('#b_redo', future.length);
  set('#mu_undo', past.length); set('#mu_redo', future.length);
}
function mutate(fn) { pushHistory(); fn(); render(); save(); }

/* ================= acabamento (estimativa de anel) ================= */
function bindingEstimate() {
  const n = pageCount();
  const e = EPBinding.estimate({ sheets: n, pages: n, gsm: state.settings.bindGsm, paperKind: state.settings.bindKind });
  e.bindingLabel = (BINDING_TYPES[state.settings.binding] || BINDING_TYPES.none).label;
  return e;
}

/* ================= modelos ================= */
// aplica só as settings do modelo (tamanho/estilo/paleta/encadernação/capa);
// fotos e legendas já preenchidas pelo usuário não são mexidas.
// Achado de correção: "palette" só guarda a CHAVE (ex.: 'floresta') — quem
// de fato pinta ink/accent/paperBg é o clique manual num swatch (ver
// bindDoc() em ui.js). Um modelo que só passa settings.palette sem também
// passar ink/accent/paperBg deixava a cor visível do documento intacta
// (herdada do que already estava em state.settings), mesmo a paleta
// selecionada mudando — a pessoa clicava no modelo e "nada mudava".
function applyTemplate(t) {
  const merged = { ...t.settings };
  if (merged.palette && PALETTES[merged.palette] && !('ink' in merged)) {
    const p = PALETTES[merged.palette];
    merged.ink = p.ink; merged.accent = p.accent; merged.paperBg = p.paperBg;
  }
  state.settings = migrate({ settings: { ...state.settings, ...merged } }).settings;
}

/* ================= documento novo ================= */
function newDoc() {
  state = newState();
  currentPage = 0; past = []; future = []; histMeta = [];
  _holCache = null; _evCache = null;
  if (typeof _dpiPxCache !== 'undefined') _dpiPxCache.clear();
}
