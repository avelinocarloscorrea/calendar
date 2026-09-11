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
  return { schema: 1, settings: { ...DEFAULTS }, months: Array.from({ length: 12 }, emptyMonth) };
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
    exportMode: (ds.exportMode === 'fit' && !isStand) ? 'fit' : 'real',
    sheet: ds.sheet === 'a3' ? 'a3' : 'a4',
    exportDPI: clamp(Math.round(num(ds.exportDPI, DEFAULTS.exportDPI)), 150, 600),
  };
  const mIn = Array.isArray(src.months) ? src.months : [];
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = (mIn[i] && typeof mIn[i] === 'object') ? mIn[i] : {};
    return {
      photo: validImageSrc(m.photo) ? m.photo : '',
      photoSrc: validImageSrc(m.photoSrc) ? m.photoSrc : '',
      photoEdit: normPhotoEdit(m.photoEdit),
      caption: sanitizeText(m.caption, 120),
    };
  });
  return { schema: 1, settings, months };
}

/* ================= persistência ================= */
let saveT, _saveWarned = false;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); _saveWarned = false; }
    catch (e) {
      if (!_saveWarned) { _saveWarned = true; try { toast('Não coube no armazenamento do navegador (foto grande?). Use "Salvar projeto" no menu para não perder.'); } catch (_) {} }
    }
  }, 300);
}
function load() {
  let d; try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  state = (d && typeof d === 'object') ? migrate(d) : newState();
}

/* ================= geometria ================= */
function paperWH() { const p = SIZES[state.settings.size] || SIZES.a4p; return [p.w, p.h]; }

/* ================= páginas ================= */
function expand() {
  const pages = [];
  if (state.settings.showCover) pages.push({ kind: 'cover' });
  for (let m = 1; m <= 12; m++) pages.push({ kind: 'month', m });
  return pages;
}
function pageCount() { return expand().length; }
function curPage() { return expand()[clamp(currentPage, 0, pageCount() - 1)] || null; }

/* ================= feriados / eventos ================= */
let _holCache = null, _holSig = '';
function holidayIndex() {
  const s = state.settings;
  const sig = s.year + '|' + s.uf + '|' + s.holNacional + '|' + s.holFacultativo + '|' + s.holComemorativa;
  if (_holCache && _holSig === sig) return _holCache;
  let list = EPDates.holidaysForYear(s.year, { uf: s.uf || null, includeOptional: s.holFacultativo, includeCommemorative: s.holComemorativa });
  if (!s.holNacional) list = list.filter(h => h.type !== 'nacional');
  const map = Object.create(null);
  list.forEach(h => { (map[h.ymd] || (map[h.ymd] = [])).push(h.name); });
  _holCache = map; _holSig = sig;
  return map;
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
function contentInset(box, bindingKey) {
  const b = BINDING_TYPES[bindingKey] || BINDING_TYPES.none;
  if (!b.edge || !b.marginMm) return { box, strip: null };
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
  if (b.edge === 'top') {
    const cy = strip.y + strip.h / 2;
    for (let x = strip.x + b.holeGap; x <= strip.x + strip.w - b.holeGap * 0.6; x += b.holeGap) pen.circle(x, cy, b.holeR, holeS);
    pen.line(strip.x, strip.y + strip.h, strip.x + strip.w, strip.y + strip.h, boundary);
  } else {
    const cx = strip.x + strip.w / 2;
    for (let y = strip.y + b.holeGap; y <= strip.y + strip.h - b.holeGap * 0.6; y += b.holeGap) pen.circle(cx, y, b.holeR, holeS);
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

/* ================= cor ================= */
function hx(c) { c = HEX.test(c) ? c : '#000000'; if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
function mixHex(a, b, t) { const A = hx(a), B = hx(b); return '#' + [0, 1, 2].map(i => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join(''); }

/* ================= desenho ================= */
function drawCover(pen, box, s) {
  const { w, h } = box;
  const pad = clamp(Math.min(w, h) * 0.035, 5, 10);
  const hasPhoto = !!s.coverPhoto;
  if (hasPhoto && pen.image) {
    pen.image(s.coverPhoto, box.x, box.y, w, h, { fit: 'cover' });
  } else {
    pen.rect(box.x, box.y, w, h, { fill: s.paperBg });
    pen.rect(box.x + pad, box.y + pad, w - 2 * pad, h - 2 * pad, { stroke: s.accent, w: 0.6 });
  }
  const bandH = clamp(h * 0.30, 46, 110);
  const by = box.y + h - bandH;
  pen.rect(box.x, by, w, bandH, { fill: s.paperBg, fillOpacity: hasPhoto ? 0.93 : 1 });
  pen.line(box.x, by, box.x + w, by, { w: 0.5, color: s.accent });
  const title = s.title || 'Calendário';
  const titleSize = pen.fitText ? pen.fitText(title, w - 2 * pad, 34, 14, true, 'serif') : 24;
  pen.text(title, box.x + w / 2, by + bandH * 0.36, { size: titleSize, font: 'bold', family: 'serif', color: s.ink, align: 'c', baseline: 'middle' });
  const sub = [String(s.year), s.owner].filter(Boolean).join('   ·   ');
  pen.text(sub, box.x + w / 2, by + bandH * 0.70, { size: 11, family: 'sans', color: s.accent, align: 'c', baseline: 'middle', font: 'bold' });
}

function monthLayout(style, box) {
  const pad = clamp(Math.min(box.w, box.h) * 0.035, 5, 9);
  const x = box.x + pad, y = box.y + pad, w = box.w - 2 * pad, h = box.h - 2 * pad;
  if (style === 'sografe') {
    const headH = Math.min(16, h * 0.12);
    return { photo: null, head: { x, y, w, h: headH }, grid: { x, y: y + headH + 3, w, h: h - headH - 3 } };
  }
  if (style === 'fotolado') {
    const pw = w * 0.36;
    return { photo: { x, y, w: pw, h }, head: { x: x + pw + 6, y, w: w - pw - 6, h: 15 }, grid: { x: x + pw + 6, y: y + 19, w: w - pw - 6, h: h - 19 } };
  }
  if (style === 'fotofundo') {
    const panelTop = y + h * 0.38;
    return {
      photoFull: box,
      panel: { x: box.x, y: panelTop - 4, w: box.w, h: (box.y + box.h) - (panelTop - 4) },
      head: { x, y: panelTop + 5, w, h: 15 },
      grid: { x, y: panelTop + 23, w, h: (box.y + box.h - pad) - (panelTop + 23) },
    };
  }
  if (style === 'moldura') {
    const cardW = w * 0.86, cardH = h * 0.52;
    const cx = x + (w - cardW) / 2, cy = box.y + box.h - pad - cardH;
    return {
      photoFull: box,
      card: { x: cx, y: cy, w: cardW, h: cardH },
      head: { x: cx + 7, y: cy + 7, w: cardW - 14, h: 15 },
      grid: { x: cx + 7, y: cy + 25, w: cardW - 14, h: cardH - 32 },
    };
  }
  if (style === 'fotocanto') {
    const thumb = clamp(Math.min(w * 0.22, h * 0.16), 20, 34);
    return {
      photoThumb: { x, y, w: thumb, h: thumb },
      head: { x: x + thumb + 6, y, w: w - thumb - 6, h: thumb },
      grid: { x, y: y + thumb + 8, w, h: h - thumb - 8 },
    };
  }
  // fototopo (padrão)
  const ph = h * 0.48;
  return { photo: { x, y, w, h: ph }, head: { x, y: y + ph + 5, w, h: 15 }, grid: { x, y: y + ph + 23, w, h: h - ph - 23 } };
}

function drawMonthHead(pen, r, s, m, caption) {
  const name = EPDates.MONTHS_PT[m - 1];
  pen.text(name, r.x, r.y, { size: 16, font: 'bold', family: 'serif', color: s.ink, align: 'l', baseline: 'top' });
  pen.text(String(s.year), r.x + r.w, r.y + 2, { size: 10, family: 'sans', color: s.accent, align: 'r', baseline: 'top', font: 'bold' });
  if (caption) {
    const txt = EPDates.applyVars(caption, { date: new Date(s.year, m - 1, 1), year: s.year });
    if (txt) pen.text(txt, r.x, r.y + r.h - 1, { size: 8.5, family: 'sans', color: mixHex(s.ink, s.paperBg, 0.35), align: 'l', baseline: 'alphabetic', font: 'it' });
  }
}

function drawMonthGrid(pen, r, s, m) {
  const year = s.year, weekStart = s.weekStart;
  const order = weekStart === 'sun' ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0];
  const dowLbl = weekStart === 'sun' ? ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] : ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  const first = new Date(year, m - 1, 1);
  const startCol = order.indexOf(first.getDay());
  const dim = EPDates.daysInMonth(year, m);
  const rows = Math.ceil((startCol + dim) / 7);
  const headH = Math.min(7, r.h * 0.09);
  const cw = r.w / 7, rh = (r.h - headH) / rows;
  const gridLine = mixHex(s.ink, s.paperBg, 0.82);
  for (let c = 0; c < 7; c++) {
    pen.text(dowLbl[c], r.x + c * cw + cw / 2, r.y + headH / 2, { size: Math.min(8.5, headH * 0.6), font: 'bold', color: mixHex(s.ink, s.paperBg, 0.4), align: 'c', baseline: 'middle', family: 'sans' });
  }
  pen.line(r.x, r.y + headH, r.x + r.w, r.y + headH, { w: 0.35, color: gridLine });
  for (let day = 1; day <= dim; day++) {
    const idx = startCol + day - 1, rr = Math.floor(idx / 7), cc = idx % 7;
    const cx = r.x + cc * cw, cy = r.y + headH + rr * rh;
    pen.rect(cx, cy, cw, rh, { stroke: gridLine, w: 0.2 });
    const dt = new Date(year, m - 1, day);
    const dow = dt.getDay();
    const mark = markOn(dt);
    const numColor = mark ? s.accent : (dow === 0 || dow === 6 ? mixHex(s.ink, s.paperBg, 0.3) : s.ink);
    pen.text(String(day), cx + 2, cy + 1.6, { size: Math.min(9.5, rh * 0.26, cw * 0.34), color: numColor, font: mark ? 'bold' : 'reg', baseline: 'top' });
    if (mark && rh > 9) {
      const lines = pen.wrapText ? pen.wrapText(mark, cw - 3, Math.min(6, rh * 0.15), false, 2, 'sans') : [mark];
      let ly = cy + rh - 2 - (lines.length - 1) * 3.2;
      lines.forEach(line => { if (line) { pen.text(line, cx + 1.6, ly, { size: Math.min(6, rh * 0.15), color: s.accent, baseline: 'top' }); ly += 3.2; } });
    } else if (mark) {
      pen.dot(cx + cw - 2.6, cy + 2.6, 0.9, { fill: s.accent });
    }
  }
}

function drawMonthPage(pen, box, s, m, opts) {
  const L = monthLayout(s.style, box);
  const mo = (state.months && state.months[m - 1]) || emptyMonth();
  if (s.style === 'fotofundo' || s.style === 'moldura') {
    if (mo.photo && pen.image) pen.image(mo.photo, L.photoFull.x, L.photoFull.y, L.photoFull.w, L.photoFull.h, { fit: 'cover' });
    else pen.rect(box.x, box.y, box.w, box.h, { fill: s.paperBg });
    if (s.style === 'moldura') {
      pen.rect(box.x + 5, box.y + 5, box.w - 10, box.h - 10, { stroke: s.accent, w: 0.6 });
      pen.rect(L.card.x, L.card.y, L.card.w, L.card.h, { fill: s.paperBg, fillOpacity: mo.photo ? 0.93 : 1, rx: 2 });
    } else {
      pen.rect(L.panel.x, L.panel.y, L.panel.w, L.panel.h, { fill: s.paperBg, fillOpacity: mo.photo ? 0.90 : 1 });
    }
  } else if (s.style === 'fotocanto') {
    pen.rect(box.x, box.y, box.w, box.h, { fill: s.paperBg });
    if (mo.photo && pen.image) pen.image(mo.photo, L.photoThumb.x, L.photoThumb.y, L.photoThumb.w, L.photoThumb.h, { fit: 'cover' });
    else if (opts && opts.screen) pen.rect(L.photoThumb.x, L.photoThumb.y, L.photoThumb.w, L.photoThumb.h, { stroke: mixHex(s.ink, s.paperBg, 0.75), w: 0.25, dash: [1.6, 1.6] });
    pen.rect(L.photoThumb.x, L.photoThumb.y, L.photoThumb.w, L.photoThumb.h, { stroke: s.accent, w: 0.4 });
  } else {
    pen.rect(box.x, box.y, box.w, box.h, { fill: s.paperBg });
    if (L.photo) {
      if (mo.photo && pen.image) pen.image(mo.photo, L.photo.x, L.photo.y, L.photo.w, L.photo.h, { fit: 'cover' });
      else if (opts && opts.screen) pen.rect(L.photo.x, L.photo.y, L.photo.w, L.photo.h, { stroke: mixHex(s.ink, s.paperBg, 0.75), w: 0.25, dash: [1.6, 1.6] });
    }
  }
  drawMonthHead(pen, L.head, s, m, mo.caption);
  drawMonthGrid(pen, L.grid, s, m);
}

function drawPageInto(pen, pd, idx, opts = {}) {
  const s = state.settings, [W, H] = paperWH();
  if (!opts.screen) pen.rect(0, 0, W, H, { fill: s.paperBg });
  const full = { x: 0, y: 0, w: W, h: H };
  const { box, strip } = contentInset(full, s.binding);
  if (pd.kind === 'cover') drawCover(pen, box, s);
  else drawMonthPage(pen, box, s, pd.m, opts);
  if (strip) drawPunchGuide(pen, strip, s.binding, opts);
}

function pageSig(idx, pd) {
  const s = state.settings;
  const mo = pd.kind === 'month' ? state.months[pd.m - 1] : null;
  return [idx, pd.kind, pd.m || 0, mo ? mo.photo.length + '|' + mo.caption : '',
    s.year, s.weekStart, s.uf, s.holNacional, s.holFacultativo, s.holComemorativa, s.events,
    s.ink, s.accent, s.paperBg, s.size, s.style, s.title, s.owner, s.showCover,
    s.coverPhoto.length, s.binding, s.showPunch].join('|');
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
  currentPage = clamp(i, 0, Math.max(0, n - 1));
  render();
  const pg = sheetsEl.children[currentPage];
  // instantâneo (não 'smooth'): evita a rolagem "correr atrás" e o listener de
  // rolagem recalcular currentPage a partir de uma posição intermediária,
  // brigando com a página que acabou de ser escolhida no clique.
  if (pg) pg.scrollIntoView({ block: 'center', behavior: 'auto' });
}

/* ================= histórico ================= */
let past = [], future = [];
const snap = () => JSON.stringify(state);
function pushHistory() { past.push(snap()); if (past.length > 40) past.shift(); future.length = 0; updateHistoryButtons(); }
function applySnap(str) { state = migrate(JSON.parse(str)); render(); save(); }
function undo() { if (!past.length) return; future.push(snap()); applySnap(past.pop()); toast('Desfeito'); }
function redo() { if (!future.length) return; past.push(snap()); applySnap(future.pop()); }
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
function applyTemplate(t) {
  state.settings = migrate({ settings: { ...state.settings, ...t.settings } }).settings;
}

/* ================= documento novo ================= */
function newDoc() {
  state = newState();
  currentPage = 0; past = []; future = [];
  _holCache = null; _evCache = null;
}
