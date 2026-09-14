/* Calendar Studio — js/sheet-edit.js
   Edição direta na folha (estilo Canva): na capa, título/ano/nome e a foto;
   nos meses, nome do mês, ano, legenda (posição e estilo valem para os 12
   meses, para o calendário ficar uniforme) e a foto do mês — enquadrada ali
   mesmo, com a prévia na própria página. Motor: vendor/core/canvas-edit.js.
   (parte de app; carregado depois de ui.js) */
"use strict";

const CAL_MONTH_KEYS = /^(mname|myear|caption)$/;

function calPageInfo(pageEl) {
  if (!pageEl || pageEl.dataset.idx == null) return null;
  const idx = +pageEl.dataset.idx, pd = expand()[idx];
  if (!pd || (pd.kind !== 'cover' && pd.kind !== 'month')) return null;
  return { idx, pd };
}
function calStore(key) {
  const s = state.settings;
  if (CAL_MONTH_KEYS.test(key)) return (s.elMonth = s.elMonth || {});
  return (s.el = s.el || {});
}
function calPhotoObj(info) {
  return info.pd.kind === 'cover' ? coverPhotoAdapter() : state.months[info.pd.m - 1];
}
let _calRaf = 0;
function calRedraw(info, live) {
  const draw = () => {
    _calRaf = 0;
    const el = sheetsEl.children[info.idx];
    if (el) { el.innerHTML = buildSVG(info.idx, info.pd); el.dataset.sig = ''; }
    if (!live) { render(); save(); }
  };
  if (live) { if (!_calRaf) _calRaf = requestAnimationFrame(draw); }
  else { if (_calRaf) cancelAnimationFrame(_calRaf); draw(); }
}

const calEditor = EPCanvasEdit.create({
  sheets: sheetsEl,
  zoom: () => zoom,
  isMobile: () => isMobile(),
  scroller: () => stage,
  fonts: Object.entries((typeof EPFontMetrics !== 'undefined' && EPFontMetrics.families) || {}).map(([v, f]) => ({ v, label: f.label.split(' — ')[0] })),
  hits(pageEl) {
    const info = calPageInfo(pageEl); if (!info) return null;
    const [W, H] = paperWH(), hits = [];
    try { drawPageInto(SvgPen(W, H, {}), info.pd, info.idx, { screen: true, hits }); } catch (e) { return null; }
    return { w: W, h: H, items: hits };
  },
  get(pageEl, key) {
    const info = calPageInfo(pageEl); if (!info) return null;
    const e = calStore(key)[key] || {};
    const out = { dx: e.dx || 0, dy: e.dy || 0, s: e.s || 1, color: e.color || null, fam: e.fam || '', bold: e.bold == null ? null : e.bold };
    if (key === 'title') { out.text = state.settings.title; out.textLabel = 'Título'; }
    else if (key === 'owner') { out.text = state.settings.owner; out.textLabel = 'Nome ou dedicatória'; }
    else if (key === 'caption' && info.pd.kind === 'month') { out.text = state.months[info.pd.m - 1].caption; out.textLabel = 'Legenda do mês'; }
    if (key === 'photo' || key === 'cphoto') { const mo = calPhotoObj(info); out.canReplace = true; out.removable = !!(mo && mo.photoSrc); }
    return out;
  },
  begin() { pushHistory(); },
  photo(pageEl, key, win, tools) {
    const info = calPageInfo(pageEl); if (!info) return null;
    const mo = calPhotoObj(info); if (!mo || !mo.photoSrc) return null;
    const it = (this.hits(pageEl) || { items: [] }).items.find(i => i.key === key); if (!it) return null;
    return EPImgEdit.onSheet(win, tools, {
      src: mo.photoSrc, edit: mo.photoEdit, aspect: it.w / it.h, outMax: outMaxFor(it.w, it.h),
      onHistoryPoint: () => pushHistory(),
      onCommit: res => { mo.photo = res.dataURL; mo.photoEdit = res.edit; calRedraw(info, false); if (typeof renderMonthList === 'function') renderMonthList(); },
    });
  },
  set(pageEl, key, patch, opts) {
    const info = calPageInfo(pageEl); if (!info) return;
    if ('text' in patch) {
      if (key === 'title') state.settings.title = sanitizeText(patch.text, 60);
      else if (key === 'owner') state.settings.owner = sanitizeText(patch.text, 60);
      else if (key === 'caption' && info.pd.kind === 'month') state.months[info.pd.m - 1].caption = sanitizeText(patch.text, 120);
    }
    const geo = {};
    ['dx', 'dy', 's', 'color', 'fam', 'bold'].forEach(k => { if (k in patch) geo[k] = patch[k]; });
    if (Object.keys(geo).length) {
      const store = calStore(key);
      const e = store[key] = { ...(store[key] || {}), ...geo };
      Object.keys(e).forEach(k => { if (e[k] === null || e[k] === '' || e[k] === undefined) delete e[k]; });
      delete e.hide;
    }
    calRedraw(info, opts && opts.live);
  },
  action(pageEl, key, name) {
    const info = calPageInfo(pageEl); if (!info) return;
    const store = calStore(key);
    if (name === 'reset') delete store[key];
    else if (name === 'hide') { store[key] = { ...(store[key] || {}), hide: true }; toast('Oculto — para mostrar de novo use “Restaurar textos da folha” em Ajustes.'); }
    else if (name === 'delete' && (key === 'photo' || key === 'cphoto')) { const mo = calPhotoObj(info); mo.photo = ''; mo.photoSrc = ''; mo.photoEdit = null; }
    else if (name === 'image' && (key === 'photo' || key === 'cphoto')) {
      const mo = calPhotoObj(info);
      pickNewPhoto({ key: info.pd.kind === 'cover' ? 'cover' : 'month:' + info.pd.m, keepEdit: mo.photoEdit, cb: res => {
        Object.assign(mo, res); pushHistory();
        // assa a 1ª versão já na caixa certa
        const hit = (() => { const [W, H] = paperWH(), hits = []; drawPageInto(SvgPen(W, H, {}), info.pd, info.idx, { screen: true, hits }); return hits.find(h => h.key === key); })();
        EPImgEdit.loadImage(mo.photoSrc).then(im => {
          const [ow, oh] = hit ? (hit.w >= hit.h ? [outMaxFor(hit.w, hit.h), Math.round(outMaxFor(hit.w, hit.h) * hit.h / hit.w)] : [Math.round(outMaxFor(hit.w, hit.h) * hit.w / hit.h), outMaxFor(hit.w, hit.h)]) : [2400, 2400];
          mo.photo = EPImgEdit.bakeDataURL(im, mo.photoEdit || EPImgEdit.defaultEdit(), ow, oh);
          calRedraw(info, false); if (typeof renderMonthList === 'function') renderMonthList();
          calEditor.clear(); setTimeout(() => calEditor.select(sheetsEl.children[info.idx], key), 60);
        });
      } });
      return;
    }
    calRedraw(info, false);
  },
  colors() {
    const s = state.settings;
    return [...new Set([s.ink, s.accent, s.paperBg, '#1f2522', '#ffffff', mixHex(s.accent, s.paperBg, 0.5), '#8a2f2f', '#35594d', '#1f3a52'].map(c => c.toLowerCase()))];
  },
});

// restaurar tudo (Ajustes) e acompanhar os redesenhos
function calResetSheetEdits() {
  pushHistory(); state.settings.el = {}; state.settings.elMonth = {};
  render(); save(); calEditor.refresh();
  toast('Posições, tamanhos e cores dos textos restaurados.');
}
{
  const _render = render;
  render = function () { _render.apply(this, arguments); if (!calEditor.isBusy()) calEditor.refresh(); };
  const _zoom = applyZoom;
  applyZoom = function () { _zoom.apply(this, arguments); if (calEditor.current()) calEditor.refresh(); };
  sheetsEl.addEventListener('click', e => {
    const pg = e.target.closest && e.target.closest('.page'); if (!pg) return;
    if (!calPageInfo(pg)) { calEditor.clear(); return; }
    if (!calEditor.pick(pg, e.clientX, e.clientY)) calEditor.show(pg);
  });
}

{ const b = document.getElementById('d_resetSheet'); if (b) b.onclick = calResetSheetEdits; }
