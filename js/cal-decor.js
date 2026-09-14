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
  return raw.slice(0, 30).map(x => {
    x = x && typeof x === 'object' ? x : {};
    const type = ['art', 'image'].includes(x.type) ? x.type : 'text';
    return { ...EPTextFx.clean(x), id: /^[A-Za-z0-9_-]{1,24}$/.test(x.id || '') ? x.id : uid(), type,
      text: type === 'text' ? sanitizeText(x.text || '', 300) : '',
      art: type === 'art' && typeof EPArt !== 'undefined' && EPArt.isId(x.art) ? x.art : '',
      src: type === 'image' && typeof x.src === 'string' && x.src.length < 4e6 && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(x.src) ? x.src : '' };
  }).filter(x => x.type === 'text' || x.art || x.src);
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
    const f = EPTextFx.norm(x); if (f.hide) return;
    const cx = W / 2 + f.dx, cy = H / 2 + f.dy, key = 'x:' + x.id;
    if (x.type === 'image') {
      const w = 50 * k * f.s, dim = typeof imageDims === 'function' ? imageDims(x.src) : null, h = dim && dim.w ? w * dim.h / dim.w : w;
      const P = EPTextFx.pen(pen, f);
      P.image(x.src, cx - w / 2, cy - h / 2, w, h, { fit: 'meet' });
      calHit(key, 'Imagem', 'image', cx - w / 2, cy - h / 2, w, h, P);
      return;
    }
    if (x.type === 'art') {
      const it = EPArt.get(x.art), base = 44 * k * f.s, ar = it ? it.w / it.h : 1;
      const w = ar >= 1 ? base : base * ar, h = ar >= 1 ? base / ar : base;
      const P = EPTextFx.pen(pen, f);
      if (pen.art) P.art(x.art, cx - w / 2, cy - h / 2, w, h, { color: f.color || s.accent });
      calHit(key, 'Ilustração', 'art', cx - w / 2, cy - h / 2, w, h, P);
      return;
    }
    const b = EPTextFx.block(pen, String(x.text || 'Texto'), cx, cy, 18 * k * f.s, f, { fam: 'serif', color: s.ink, lh: 1.25 });
    calHit(key, 'Texto', 'text', b.x, b.y, b.w, b.h);
  });
}
function calUsedArt() {
  if (!state) return [];
  const ids = [];
  const add = l => (l || []).forEach(x => { if (x.type === 'art' && x.art) ids.push(x.art); });
  add(state.settings.extras); state.months.forEach(m => add(m.extras));
  [state.settings.bg, state.settings.coverBg, ...state.months.map(m => m.pageBg)].forEach(b => { if (b && b.kind === 'pattern' && b.pat === 'art' && b.art) ids.push(b.art); });
  if (state.settings.wm && state.settings.wm.on && state.settings.wm.kind === 'art' && state.settings.wm.art) ids.push(state.settings.wm.art);
  if (['script', 'wreath', 'boho'].includes(state.settings.coverStyle)) ids.push('enfeites/ramo');
  return ids;
}
