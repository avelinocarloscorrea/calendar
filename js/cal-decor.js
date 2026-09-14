/* Calendar Studio — js/cal-decor.js
   Elementos livres da capa e de cada mês: textos e ilustrações do catálogo
   (EPArt) — ex.: uma árvore de Natal só em dezembro. Ficam em
   settings.extras (capa) e months[i].extras (mês), cada um com a própria
   posição: { id, type:'text'|'art', text, art, dx, dy (mm, a partir do
   centro da página), s, color, fam, bold }.
   (parte de app; carregado depois de calendar.js) */
"use strict";

function calCleanExtras(raw) {
  if (!Array.isArray(raw)) return [];
  const fams = (typeof EPFontMetrics !== 'undefined' && EPFontMetrics.families) || {};
  return raw.slice(0, 30).map(x => {
    x = x && typeof x === 'object' ? x : {};
    const type = x.type === 'art' ? 'art' : 'text';
    const out = { id: /^[A-Za-z0-9_-]{1,24}$/.test(x.id || '') ? x.id : uid(), type,
      text: type === 'text' ? sanitizeText(x.text || '', 300) : '',
      art: type === 'art' && typeof EPArt !== 'undefined' && EPArt.isId(x.art) ? x.art : '' };
    ['dx', 'dy'].forEach(k => { out[k] = isFinite(+x[k]) ? clamp(+x[k], -900, 900) : 0; });
    out.s = isFinite(+x.s) && +x.s ? clamp(+x.s, 0.2, 6) : 1;
    if (HEX.test(x.color || '')) out.color = x.color;
    if (x.fam && fams[x.fam]) out.fam = x.fam;
    if (x.bold != null) out.bold = !!x.bold;
    return out;
  }).filter(x => x.type === 'text' || x.art);
}
// lista de elementos da página (a própria referência do estado — editável)
function calExtrasOf(pd) {
  if (!pd || !state) return null;
  if (pd.kind === 'cover') return (state.settings.extras = state.settings.extras || []);
  if (pd.kind === 'month') { const mo = state.months[pd.m - 1]; return mo ? (mo.extras = mo.extras || []) : null; }
  return null;
}
function calDrawExtras(pen, list, W, H, s) {
  const k = clamp(Math.min(W, H * 1.25) / 190, 0.5, 2.2);        // mesma escala tipográfica das páginas
  list.forEach(x => {
    const cx = W / 2 + x.dx, cy = H / 2 + x.dy, key = 'x:' + x.id;
    if (x.type === 'art') {
      const it = EPArt.get(x.art), base = 44 * k * x.s, ar = it ? it.w / it.h : 1;
      const w = ar >= 1 ? base : base * ar, h = ar >= 1 ? base / ar : base;
      if (pen.art) pen.art(x.art, cx - w / 2, cy - h / 2, w, h, { color: x.color || s.accent });
      calHit(key, 'Ilustração', 'art', cx - w / 2, cy - h / 2, w, h);
      return;
    }
    const size = 18 * k * x.s, fam = x.fam || 'serif', lines = String(x.text || 'Texto').split('\n'), lh = size * 1.25 / PT;
    let wmax = 0;
    lines.forEach((l, j) => {
      wmax = Math.max(wmax, pen.textWidth(l, size, !!x.bold, fam));
      pen.text(l, cx, cy - (lines.length - 1) * lh / 2 + j * lh, { size, family: fam, font: x.bold ? 'bold' : undefined, color: x.color || s.ink, align: 'c', baseline: 'middle' });
    });
    calHit(key, 'Texto', 'text', cx - wmax / 2, cy - lines.length * lh / 2, wmax, lines.length * lh);
  });
}
function calUsedArt() {
  if (!state) return [];
  const ids = [];
  const add = l => (l || []).forEach(x => { if (x.type === 'art' && x.art) ids.push(x.art); });
  add(state.settings.extras); state.months.forEach(m => add(m.extras));
  if (['script', 'wreath', 'boho'].includes(state.settings.coverStyle)) ids.push('enfeites/ramo');
  return ids;
}
