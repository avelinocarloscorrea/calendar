/* Calendar Studio — js/sheet-edit.js
   Edição direta na folha (estilo Canva): na capa, título/ano/nome, enfeite e
   a foto; nos meses, nome do mês, ano, legenda (posição e estilo valem para
   os 12 meses, para o calendário ficar uniforme) e a foto do mês — enquadrada
   ali mesmo. Tocar na página sem elemento abre "Adicionar": texto ou
   ilustração só naquela página (js/cal-decor.js).
   Motor: vendor/core/canvas-edit*.js. (parte de app; carregado depois de ui.js) */
"use strict";

const CAL_MONTH_KEYS = /^(mname|myear|caption)$/;
const CAL_ICON = {
  text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6V4h14v2M12 4v16M9 20h6"/></svg>',
  art: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20c-4-3-8-6-8-10a4 4 0 017.5-2A4 4 0 0120 10c0 4-4 7-8 10z"/><path d="M18 2.5l.8 1.7 1.7.8-1.7.8L18 7.5l-.8-1.7-1.7-.8 1.7-.8z"/></svg>',
  bg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15l6-6 12 12M14 3l7 7"/></svg>',
  wm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5.5" stroke-dasharray="2 2"/><path d="M9.5 12h5"/></svg>',
  photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/></svg>',
};

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
const calExtra = (info, key) => key.startsWith('x:') ? (calExtrasOf(info.pd) || []).find(x => 'x:' + x.id === key) : null;
function calPhotoObj(info) {
  return info.pd.kind === 'cover' ? coverPhotoAdapter() : state.months[info.pd.m - 1];
}
function calHitsFor(info) {
  const [W, H] = paperWH(), hits = [];
  drawPageInto(SvgPen(W, H, {}), info.pd, info.idx, { screen: true, hits });
  return { w: W, h: H, items: hits };
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
function calReselect(idx, key) {
  calEditor.clear();
  setTimeout(() => { const pg = sheetsEl.children[idx]; if (pg) calEditor.select(pg, key); }, 40);
}
function calAdd(info, type) {
  const list = calExtrasOf(info.pd); if (!list) return;
  const add = patch => {
    pushHistory();
    const x = { id: uid(), type, text: '', art: '', dx: 0, dy: 0, s: 1, ...patch };
    list.push(x); render(); save();
    calReselect(info.idx, 'x:' + x.id);
  };
  if (type === 'art') EPArtPicker.open({ title: info.pd.kind === 'cover' ? 'Ilustração na capa' : 'Ilustração em ' + EPDates.MONTHS_PT[info.pd.m - 1], onPick: id => EPArt.ensure([id]).then(() => add({ art: id })) });
  else if (type === 'image') EPStudio.pickImage(src => add({ src }), { max: 1200, onError: toast });
  else add({ text: 'Seu texto' });
}

const calEditor = EPCanvasEdit.create({
  sheets: sheetsEl,
  zoom: () => zoom,
  isMobile: () => isMobile(),
  scroller: () => stage,
  fonts: Object.entries((typeof EPFontMetrics !== 'undefined' && EPFontMetrics.families) || {}).map(([v, f]) => ({ v, label: f.label.split(' — ')[0] })),
  addTools: [
    { a: 'text', label: 'Texto', icon: CAL_ICON.text, title: 'Adicionar texto nesta página' },
    { a: 'art', label: 'Ilustração', icon: CAL_ICON.art, title: 'Adicionar ilustração nesta página' },
    { a: 'image', label: 'Imagem', icon: CAL_ICON.photo, title: 'Adicionar imagem (logo, adesivo…)' },
    { a: 'photo', label: 'Foto', icon: CAL_ICON.photo, title: 'Foto desta página' },
    { a: 'bg', label: 'Fundo', icon: CAL_ICON.bg, title: 'Fundo da página' },
    { a: 'wm', label: "Marca d'água", icon: CAL_ICON.wm, title: "Marca d'água" },
  ],
  add(pageEl, a) {
    const info = calPageInfo(pageEl); if (!info) return;
    if (a === 'bg') { openBackgroundPop(info.pd); return; }
    if (a === 'wm') { openWatermarkPop(); return; }
    if (a !== 'photo') { calAdd(info, a); return; }
    const key = calHitsFor(info).items.find(i => i.kind === 'photo');
    if (key) calReselect(info.idx, key.key);
    else toast('Este estilo de página não tem foto — troque o estilo em Ajustes.');
  },
  hits(pageEl) {
    const info = calPageInfo(pageEl); if (!info) return null;
    try { return calHitsFor(info); } catch (e) { return null; }
  },
  get(pageEl, key) {
    const info = calPageInfo(pageEl); if (!info) return null;
    const x = calExtra(info, key);
    if (x) {
      const out = { ...EPTextFx.norm(x), fam: x.fam || '', removable: true, duplicable: true, layer: true };
      if (x.type === 'text') { out.text = x.text; out.textLabel = 'Texto'; out.multiline = true; out.maxlength = 300; out.alignable = true; }
      else if (x.type === 'image') out.canReplace = true;
      else { const it = EPArt.get(x.art); out.canReplace = true; out.colorable = !it || it.mono; }
      return out;
    }
    const e = calStore(key)[key] || {};
    const out = { ...EPTextFx.norm(e), fam: e.fam || '' };
    if (key === 'title') { out.text = state.settings.title; out.textLabel = 'Título'; }
    else if (key === 'owner') { out.text = state.settings.owner; out.textLabel = 'Nome ou dedicatória'; }
    else if (key === 'caption' && info.pd.kind === 'month') { out.text = state.months[info.pd.m - 1].caption; out.textLabel = 'Legenda do mês'; }
    else if (key === 'orn') out.colorable = true;
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
    const x = calExtra(info, key);
    const geo = { ...patch }; delete geo.text;
    if (x) {
      if ('text' in patch) x.text = sanitizeText(patch.text, 300);
      if (Object.keys(geo).length) { const m = EPTextFx.merge(EPTextFx.clean(x), geo); EPTextFx.KEYS.forEach(k => { delete x[k]; }); Object.assign(x, m); }
    } else {
      if ('text' in patch) {
        if (key === 'title') state.settings.title = sanitizeText(patch.text, 60);
        else if (key === 'owner') state.settings.owner = sanitizeText(patch.text, 60);
        else if (key === 'caption' && info.pd.kind === 'month') state.months[info.pd.m - 1].caption = sanitizeText(patch.text, 120);
      }
      if (Object.keys(geo).length) {
        const store = calStore(key);
        store[key] = EPTextFx.merge(store[key], { ...geo, hide: null });
      }
    }
    calRedraw(info, opts && opts.live);
  },
  action(pageEl, key, name) {
    const info = calPageInfo(pageEl); if (!info) return;
    const x = calExtra(info, key), list = calExtrasOf(info.pd);
    if (x) {
      if (name === 'delete' || name === 'hide') list.splice(list.indexOf(x), 1);
      else if (name === 'reset') { EPTextFx.KEYS.forEach(k => { delete x[k]; }); }
      else if (name === 'front' || name === 'back') { list.splice(list.indexOf(x), 1); if (name === 'front') list.push(x); else list.unshift(x); }
      else if (name === 'duplicate') { const c = { ...x, id: uid(), dx: (+x.dx || 0) + 8, dy: (+x.dy || 0) + 8 }; list.push(c); calRedraw(info, false); return 'x:' + c.id; }
      else if (name === 'image' && x.type === 'image') {
        EPStudio.pickImage(src => { pushHistory(); x.src = src; calRedraw(info, false); calReselect(info.idx, key); }, { max: 1200, onError: toast });
        return;
      }
      else if (name === 'image') {
        EPArtPicker.open({ title: 'Trocar ilustração', current: x.art, onPick: id => { pushHistory(); x.art = id; EPArt.ensure([id]).then(() => { calRedraw(info, false); calReselect(info.idx, key); }); } });
        return;
      }
      calRedraw(info, false);
      return;
    }
    const store = calStore(key);
    if (name === 'reset') delete store[key];
    else if (name === 'hide') { store[key] = { ...(store[key] || {}), hide: true }; toast('Oculto — para mostrar de novo use “Restaurar textos da folha” em Ajustes.'); }
    else if (name === 'delete' && (key === 'photo' || key === 'cphoto')) { const mo = calPhotoObj(info); mo.photo = ''; mo.photoSrc = ''; mo.photoEdit = null; }
    else if (name === 'image' && (key === 'photo' || key === 'cphoto')) {
      const mo = calPhotoObj(info);
      pickNewPhoto({ key: info.pd.kind === 'cover' ? 'cover' : 'month:' + info.pd.m, keepEdit: mo.photoEdit, cb: res => {
        Object.assign(mo, res); pushHistory();
        const hit = calHitsFor(info).items.find(h => h.key === key);
        EPImgEdit.loadImage(mo.photoSrc).then(im => {
          const mx = hit ? outMaxFor(hit.w, hit.h) : 2400;
          const [ow, oh] = hit ? (hit.w >= hit.h ? [mx, Math.round(mx * hit.h / hit.w)] : [Math.round(mx * hit.w / hit.h), mx]) : [2400, 2400];
          mo.photo = EPImgEdit.bakeDataURL(im, mo.photoEdit || EPImgEdit.defaultEdit(), ow, oh);
          calRedraw(info, false); if (typeof renderMonthList === 'function') renderMonthList();
          calReselect(info.idx, key);
        });
      } });
      return;
    }
    calRedraw(info, false);
  },
  colors() {
    const s = state.settings;
    return [...new Set([s.ink, s.accent, s.paperBg, '#1f2522', '#ffffff', mixHex(s.accent, s.paperBg, 0.5), '#8a2f2f', '#35594d', '#1f3a52', '#c9a24a', '#d98c9a'].map(c => c.toLowerCase()))];
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
  sheetsEl.addEventListener('dblclick', e => {
    const pg = e.target.closest && e.target.closest('.page'); if (!pg || isMobile() || !calPageInfo(pg)) return;
    if (calEditor.pick(pg, e.clientX, e.clientY)) calEditor.editText();
  });
  let artT = 0;
  EPArt.onLoad(() => { clearTimeout(artT); artT = setTimeout(() => { if (sheetsEl.children.length) { [...sheetsEl.children].forEach(el => { el.dataset.sig = ''; }); render(); } }, 30); });
}

{ const b = document.getElementById('d_resetSheet'); if (b) b.onclick = calResetSheetEdits; }
