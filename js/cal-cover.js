/* Calendar Studio — js/cal-cover.js
   Capa do calendário (estilos clássicos, com foto e com nome/enfeite) e os
   auxiliares da edição na folha: cada texto lê seus ajustes com calFx() e
   registra a caixa com calText()/calHit() quando a tela pede (HITS).
   (parte de app; carregado depois de calendar.js) */
"use strict";

/* ================= edição na folha =================
   state.settings.el[chave]      capa  (title, sub, year, owner, cphoto)
   state.settings.elMonth[chave] meses (mname, myear, caption) — vale para os 12 meses
   { dx, dy (mm), s (escala), color, fam, bold, hide }. HITS recebe as caixas quando a tela pede. */
let HITS = null;
function calFx(key) {
  const st = state.settings, src = /^(mname|myear|caption)$/.test(key) ? st.elMonth : st.el;
  return EPTextFx.norm((src && src[key]) || {});
}
function calHit(key, label, kind, x, y, w, h, P) {
  if (P && P.done) P.done({ x, y, w, h });
  if (HITS) HITS.push({ key, label, kind, x, y, w, h });
}
// texto editável: aplica deslocamento/escala/cor/fonte/efeitos e registra a caixa
function calText(pen, key, label, str, x, y, o) {
  const f = calFx(key); if (f.hide || !str) return;
  const size = o.size * f.s, fam = f.fam || o.family, bold = f.bold != null ? f.bold : o.font === 'bold';
  const X = x + f.dx, Y = y + f.dy, trk = (o.tracking || 0) * f.s, P = EPTextFx.pen(pen, f);
  const w = P.textWidth(str, size, bold, fam) + Math.max(0, [...str].length - 1) * trk;
  P.text(str, X, Y, { ...o, size, family: fam, font: bold ? 'bold' : (o.font === 'bold' ? undefined : o.font), color: f.color || o.color, tracking: trk || undefined });
  const x0 = o.align === 'c' ? X - w / 2 : o.align === 'r' ? X - w : X;
  const top = o.baseline === 'top' ? Y : Y - size / PT * 0.6;
  calHit(key, label, 'text', x0, top, w, size / PT * 1.2, P);
}

const COVER_STYLES_CAL = {
  auto: 'Clássica (faixa com título)', fullphoto: 'Foto inteira', photoTop: 'Foto em cima', minimal: 'Mínima (ano grande)', bold: 'Cor sólida',
  script: 'Nome em caligrafia', wreath: 'Coroa de folhas', boho: 'Boho (arco-íris)',
};
if (typeof EPArt !== 'undefined') EPArt.load('enfeites');
// enfeite do catálogo como elemento "orn" da capa (move, aumenta, recolore, oculta)
function calOrn(pen, id, cx, cy, w, h, color) {
  const f = calFx('orn'); if (f.hide || !pen.art) return;
  const W = w * f.s, H = h * f.s, X = cx + f.dx - W / 2, Y = cy + f.dy - H / 2;
  const P = EPTextFx.pen(pen, f);
  P.art(id, X, Y, W, H, { color: f.color || color });
  calHit('orn', 'Enfeite', 'art', X, Y, W, H, P);
}
// capas com nome: o nome (ou o título, se não houver nome) é o protagonista
function drawNameCover(pen, box, s, cs) {
  const { w, h } = box, k = typeK(box), cx = box.x + w / 2;
  const name = s.owner || s.title || 'Calendário', title = s.owner ? (s.title || '') : '', yr = spanLabel(s);
  const NK = s.owner ? 'owner' : 'title', NL = s.owner ? 'Nome' : 'Título';   // chave do texto grande
  const e = ext(box);
  pen.rect(e.x, e.y, e.w, e.h, { fill: cs === 'boho' ? mixHex(s.accent, s.paperBg, 0.88) : s.paperBg });
  const nameFit = (maxW, start, fam) => pen.fitText(name, maxW, start * k, 14, true, fam);
  if (cs === 'script') {
    calText(pen, 'title', 'Título', title.toUpperCase(), cx, box.y + h * 0.33, { size: clamp(12 * k, 7, 22), family: 'montserrat', color: s.accent, align: 'c', baseline: 'middle', tracking: 2 * k });
    calText(pen, NK, NL, name, cx, box.y + h * 0.45, { size: nameFit(w * 0.9, 90, 'dancing'), family: 'dancing', font: 'bold', color: s.ink, align: 'c', baseline: 'middle' });
    calOrn(pen, 'enfeites/ramo', cx, box.y + h * 0.56, w * 0.4, w * 0.2, s.accent);
    calText(pen, 'year', 'Ano', yr, cx, box.y + h * 0.84, { size: clamp(18 * k, 9, 40), family: 'montserrat', color: s.ink, align: 'c', baseline: 'middle', tracking: 4 * k });
  } else if (cs === 'wreath') {
    const d = Math.min(w * 0.8, h * 0.5), cy = box.y + h * 0.43;
    calOrn(pen, 'enfeites/coroa-louros', cx, cy, d, d, mixHex(s.accent, s.ink, 0.25));
    calText(pen, NK, NL, name, cx, cy - d * 0.02, { size: pen.fitText(name, d * 0.6, 60 * k, 10, true, 'dancing'), family: 'dancing', font: 'bold', color: s.ink, align: 'c', baseline: 'middle' });
    calText(pen, 'year', 'Ano', yr, cx, cy + d * 0.15, { size: clamp(12 * k, 7, 24), family: 'montserrat', color: s.accent, align: 'c', baseline: 'middle', tracking: 3 * k });
    calText(pen, 'title', 'Título', title.toUpperCase(), cx, box.y + h * 0.84, { size: clamp(12 * k, 7, 22), family: 'montserrat', color: s.ink, align: 'c', baseline: 'middle', tracking: 2.2 * k });
  } else {
    calOrn(pen, 'enfeites/arco-iris-boho', cx, box.y + h * 0.3, w * 0.6, w * 0.33, s.accent);
    calText(pen, NK, NL, name, cx, box.y + h * 0.52, { size: nameFit(w * 0.88, 64, 'playfair'), family: 'playfair', font: 'bold', color: s.ink, align: 'c', baseline: 'middle' });
    calText(pen, 'title', 'Título', title, cx, box.y + h * 0.6, { size: clamp(20 * k, 9, 40), family: 'dancing', color: s.accent, align: 'c', baseline: 'middle' });
    calText(pen, 'year', 'Ano', yr, cx, box.y + h * 0.86, { size: clamp(16 * k, 8, 36), family: 'montserrat', font: 'bold', color: s.ink, align: 'c', baseline: 'middle', tracking: 4 * k });
  }
}
function drawCover(pen, box, s, opts) {
  const { w, h } = box, k = typeK(box);
  const pad = clamp(Math.min(w, h) * 0.05, 5, 16);
  const cx = box.x + w / 2;
  const title = s.title || 'Calendário';
  const cs = s.coverStyle || 'auto';
  const yrLabel = spanLabel(s);
  if (cs === 'script' || cs === 'wreath' || cs === 'boho') { drawNameCover(pen, box, s, cs); return; }
  if (cs === 'fullphoto') {
    const e = ext(box);
    if (s.coverPhoto && pen.image) pen.image(s.coverPhoto, e.x, e.y, e.w, e.h, { fit: 'cover' });
    else drawPhotoPlaceholder(pen, e, s, 0, opts, true);
    calHit('cphoto', 'Foto da capa', 'photo', box.x, box.y, w, h);
    const bandH = clamp(h * 0.34, 40, 160), by = box.y + h - bandH;
    const eb = ext({ x: box.x, y: by, w, h: bandH });
    pen.rect(eb.x, eb.y, eb.w, eb.h, { fill: '#141816', fillOpacity: 0.38 });
    const tSize = pen.fitText(title, w - 2 * pad, 64 * k, 14, true, 'serif');
    calText(pen, 'sub', 'Ano', yrLabel.toUpperCase(), box.x + pad, by + bandH * 0.3, { size: clamp(11 * k, 7, 20), family: 'sans', font: 'bold', color: '#ffffff', align: 'l', baseline: 'middle', tracking: 1.4 * k });
    calText(pen, 'title', 'Título', title, box.x + pad, by + bandH * 0.58, { size: tSize, family: 'serif', font: 'bold', color: '#ffffff', align: 'l', baseline: 'middle' });
    if (s.owner) calText(pen, 'owner', 'Nome', s.owner, box.x + pad, by + bandH * 0.84, { size: clamp(11 * k, 7, 20), family: 'serif', font: 'it', color: '#ffffff', align: 'l', baseline: 'middle' });
    return;
  }
  if (cs === 'photoTop') {
    paperFill(pen, box, s);
    const ph = { x: box.x + pad, y: box.y + pad, w: w - 2 * pad, h: h * 0.62 };
    if (s.coverPhoto && pen.image) pen.image(s.coverPhoto, ph.x, ph.y, ph.w, ph.h, { fit: 'cover' });
    else drawPhotoPlaceholder(pen, ph, s, 0, opts, true);
    calHit('cphoto', 'Foto da capa', 'photo', ph.x, ph.y, ph.w, ph.h);
    const rest = box.y + h - (ph.y + ph.h);
    const tSize = pen.fitText(title, w - 4 * pad, 44 * k, 12, false, 'serif');
    calText(pen, 'title', 'Título', title, cx, ph.y + ph.h + rest * 0.36, { size: tSize, family: 'serif', color: s.ink, align: 'c', baseline: 'middle' });
    calText(pen, 'sub', 'Ano', yrLabel.toUpperCase(), cx, ph.y + ph.h + rest * 0.62, { size: clamp(11 * k, 7, 20), family: 'sans', font: 'bold', color: s.accent, align: 'c', baseline: 'middle', tracking: 2 * k });
    if (s.owner) calText(pen, 'owner', 'Nome', s.owner, cx, ph.y + ph.h + rest * 0.82, { size: clamp(10 * k, 7, 18), family: 'serif', font: 'it', color: mixHex(s.ink, s.paperBg, 0.3), align: 'c', baseline: 'middle' });
    return;
  }
  if (cs === 'minimal' || cs === 'bold') {
    const dark = cs === 'bold', bg = dark ? s.accent : s.paperBg, fg = dark ? s.paperBg : s.ink;
    { const e = ext(box); pen.rect(e.x, e.y, e.w, e.h, { fill: bg }); }
    const ySize = pen.fitText(yrLabel, w - 2 * pad, 220 * k, 24, true, 'sans');
    calText(pen, 'year', 'Ano', yrLabel, cx, box.y + h * 0.42, { size: ySize, font: 'bold', family: 'sans', color: dark ? mixHex(s.paperBg, s.accent, 0.15) : mixHex(s.accent, s.paperBg, 0.35), align: 'c', baseline: 'middle' });
    const tSize = pen.fitText(title, w - 4 * pad, 30 * k, 11, false, 'serif');
    calText(pen, 'title', 'Título', title, cx, box.y + h * 0.42 + ySize * 0.5 / PT + tSize / PT, { size: tSize, family: 'serif', color: fg, align: 'c', baseline: 'middle' });
    if (s.owner) calText(pen, 'owner', 'Nome', s.owner, cx, box.y + h - pad * 1.6, { size: clamp(11 * k, 7, 20), family: 'serif', font: 'it', color: fg, align: 'c', baseline: 'middle' });
    return;
  }
  if (s.coverPhoto && pen.image) {
    { const e = ext(box); pen.image(s.coverPhoto, e.x, e.y, e.w, e.h, { fit: 'cover' }); }
    calHit('cphoto', 'Foto da capa', 'photo', box.x, box.y, w, h);
    const bandH = clamp(h * 0.26, 34, 120);
    const by = box.y + h - bandH;
    { const e = ext({ x: box.x, y: by, w, h: bandH }); pen.rect(e.x, e.y, e.w, e.h, { fill: s.paperBg, fillOpacity: 0.94 }); }
    pen.rect(box.x, by, w, 0.9 * k, { fill: s.accent });
    const tSize = pen.fitText(title, w - 2 * pad, 40 * k, 12, false, 'serif');
    calText(pen, 'title', 'Título', title, cx, by + bandH * 0.4, { size: tSize, family: 'serif', color: s.ink, align: 'c', baseline: 'middle' });
    const sub = [spanLabel(s), s.owner].filter(Boolean).join('  ·  ').toUpperCase();
    calText(pen, 'sub', 'Ano e nome', sub, cx, by + bandH * 0.74, { size: clamp(10 * k, 6.5, 18), family: 'sans', color: s.accent, align: 'c', baseline: 'middle', font: 'bold', tracking: 0.9 * k });
    return;
  }
  // capa tipográfica (sem foto): ano grande + título + os 12 meses em miniatura
  paperFill(pen, box, s);
  pen.rect(box.x + pad, box.y + pad, w - 2 * pad, h - 2 * pad, { stroke: mixHex(s.accent, s.paperBg, 0.35), w: 0.5 * Math.sqrt(k) });
  const yr = spanLabel(s);
  const ySize = pen.fitText(yr, w - 4 * pad, 150 * k, 24, true, 'sans');
  const yY = box.y + h * 0.3;
  calText(pen, 'year', 'Ano', yr, cx, yY, { size: ySize, font: 'bold', family: 'sans', color: mixHex(s.accent, s.paperBg, 0.4), align: 'c', baseline: 'middle' });
  const tSize = pen.fitText(title, w - 4 * pad, 34 * k, 11, false, 'serif');
  const tY = yY + ySize * 0.42 / PT + tSize * 0.75 / PT;
  calText(pen, 'title', 'Título', title, cx, tY, { size: tSize, family: 'serif', color: s.ink, align: 'c', baseline: 'middle' });
  { const ft = calFx('title'); const ly = tY + ft.dy + tSize * ft.s * 0.6 / PT + 3 * k;
    if (!ft.hide) pen.line(cx + ft.dx - 9 * k, ly, cx + ft.dx + 9 * k, ly, { w: 0.5 * k, color: s.accent }); }
  // miniaturas dos meses (4×3) na parte de baixo
  const gTop = tY + tSize * 0.6 / PT + 12 * k, gBot = box.y + h - pad - (s.owner ? 16 * k : 8 * k);
  const gw = w - 4 * pad, gh = Math.max(0, gBot - gTop);
  const cols = w >= h * 0.95 ? 6 : 4, rows = 12 / cols;
  const cellW = gw / cols, cellH = gh / rows;
  if (cellH > 10 && cellW > 10) {
    const mk = clamp(Math.min(cellW, cellH) / 45, 0.35, 1.6);
    spanMonths(s).forEach(({ m, y }, i) => {
      const c = i % cols, r0 = Math.floor(i / cols);
      const gx = box.x + 2 * pad + c * cellW + cellW * 0.08, gy = gTop + r0 * cellH + cellH * 0.06;
      const iw = cellW * 0.84, ih = cellH * 0.86;
      pen.text(EPDates.MONTHS_PT[m - 1].toUpperCase(), gx, gy, { size: clamp(7 * mk * 1.4, 4, 11), font: 'bold', color: s.ink, baseline: 'top', tracking: 0.3 * mk });
      miniMonth(pen, { x: gx, y: gy + 5 * mk * 1.4, w: iw, h: ih - 5 * mk * 1.4 }, y === s.year ? s : { ...s, year: y }, m);
    });
  }
  if (s.owner) calText(pen, 'owner', 'Nome', s.owner, cx, box.y + h - pad - 7 * k, { size: clamp(12 * k, 7, 22), font: 'it', family: 'serif', color: mixHex(s.ink, s.paperBg, 0.25), align: 'c', baseline: 'middle' });
}
// calendário em miniatura (só números), usado na capa sem foto
function miniMonth(pen, r, s, m) {
  const order = s.weekStart === 'sun' ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0];
  const first = new Date(s.year, m - 1, 1), startCol = order.indexOf(first.getDay());
  const dim = EPDates.daysInMonth(s.year, m), cw = r.w / 7, rh = r.h / 6;
  const size = clamp(Math.min(cw * 0.5, rh * 0.62) * PT, 2.5, 9);
  for (let d = 1; d <= dim; d++) {
    const idx = startCol + d - 1, cc = idx % 7, rr = Math.floor(idx / 7);
    const dow = new Date(s.year, m - 1, d).getDay();
    pen.text(String(d), r.x + cc * cw + cw * 0.9, r.y + rr * rh + rh * 0.5, { size, color: (dow === 0 || dow === 6) ? s.accent : mixHex(s.ink, s.paperBg, 0.35), align: 'r', baseline: 'middle' });
  }
}

