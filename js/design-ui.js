/* Calendar Studio — js/design-ui.js
   Painéis de design com as peças do núcleo (as mesmas do Planner e do
   Polaroide): Fundo (EPBackground — do calendário todo, só da capa ou só de
   um mês), Marca d'água (EPWatermark) e Meus projetos (EPProjects).
   (parte de app; carregado depois de sheet-edit.js) */
"use strict";

const _designGate = EPStudio.gate(() => pushHistory());
function designRefresh(live) {
  [...sheetsEl.children].forEach(el => { if (el.dataset) el.dataset.sig = ''; });
  render(); if (!live) save();
  if (typeof calEditor !== 'undefined') calEditor.refresh();
}
function setBackground(bg, live) { _designGate(live); state.settings.bg = EPBackground.clean(bg); designRefresh(live); if (!live) designSync(); }
function setPageBackground(pd, bg, live) {
  _designGate(live);
  const b = EPBackground.clean(bg);
  if (pd.kind === 'cover') state.settings.coverBg = b;
  else if (state.months[pd.m - 1]) state.months[pd.m - 1].pageBg = b;
  designRefresh(live); if (!live) designSync();
}
function setWatermark(wm, live) { _designGate(live); state.settings.wm = EPWatermark.clean(wm); designRefresh(live); if (!live) designSync(); }
const designColors = () => { const s = state.settings; return [s.ink, s.accent, s.paperBg, mixHex(s.accent, s.paperBg, 0.5)]; };
const designPick = cb => EPStudio.pickImage(cb, { max: 2000, onError: toast });
const bgOpts = () => ({ get: () => state.settings.bg, set: setBackground, pickImage: designPick, colors: designColors });
const wmOpts = () => ({ get: () => state.settings.wm, set: setWatermark, pickImage: cb => EPStudio.pickImage(cb, { max: 1000, onError: toast }), colors: designColors,
  ctx: () => ({ ink: state.settings.ink, fam: 'serif' }), coversLabel: 'Também na capa', defaultText: state.settings.owner || 'Esmeralda Paper' });

let _bgPanel = null, _wmPanel = null, _popPanel = null;
function openBackgroundPop(pd) {
  const own = pd && (pd.kind === 'cover' ? state.settings.coverBg : pd.kind === 'month' && state.months[pd.m - 1] ? state.months[pd.m - 1].pageBg : null);
  let target = own && own.kind !== 'none' ? 'page' : 'doc';
  const pageName = pd ? (pd.kind === 'cover' ? 'a capa' : pd.kind === 'month' ? EPDates.MONTHS_PT[pd.m - 1] : '') : '';
  EPStudio.pop({ id: 'bg', title: 'Fundo', build: host => {
    const draw = () => {
      host.innerHTML = pageName ? `<div class="grp epbg-target"><button type="button" class="chip${target === 'doc' ? ' on' : ''}" data-t="doc">Calendário todo</button><button type="button" class="chip${target === 'page' ? ' on' : ''}" data-t="page">Só ${esc(pageName)}</button></div>` : '';
      _popPanel = EPBackground.panel(host, target === 'page'
        ? { ...bgOpts(), get: () => (pd.kind === 'cover' ? state.settings.coverBg : state.months[pd.m - 1].pageBg) || { kind: 'none' }, set: (b, live) => setPageBackground(pd, b, live) }
        : bgOpts());
      host.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { target = b.dataset.t; draw(); });
    };
    draw();
  }, onClose: () => { _popPanel = null; } });
}
function openWatermarkPop() { EPStudio.pop({ id: 'wm', title: "Marca d'água", build: h => { _popPanel = EPWatermark.panel(h, wmOpts()); }, onClose: () => { _popPanel = null; } }); }
function designSync() { [_bgPanel, _wmPanel, _popPanel].forEach(p => p && p.refresh()); }

(function initDesign() {
  const pane = document.querySelector('.pane[data-pane="estilo"]');
  if (pane && !$('#bgHost')) {
    const bgb = document.createElement('div'); bgb.className = 'grp-block';
    bgb.innerHTML = '<div class="grp-title">Fundo das páginas</div><p class="hint">Vale para o calendário todo. Para só a capa ou um mês, toque na página e use <b>Fundo</b>.</p><div id="bgHost"></div>';
    const wmb = document.createElement('div'); wmb.className = 'grp-block';
    wmb.innerHTML = '<div class="grp-title">Marca d\'água</div><div id="wmHost"></div>';
    pane.append(bgb, wmb);
    const h = pane.querySelector('.pane-h h2'); if (h) h.textContent = 'Estilo';
    const p = pane.querySelector('.pane-h p'); if (p) p.textContent = 'Paleta, fundo e marca d\'água de todas as páginas.';
    _bgPanel = EPBackground.panel($('#bgHost'), bgOpts());
    _wmPanel = EPWatermark.panel($('#wmHost'), wmOpts());
  }
  { const _sync = syncDocControls; syncDocControls = function () { _sync.apply(this, arguments); designSync(); }; }

  EPProjects.init({
    app: 'calendarstudio', label: 'Calendar Studio', toast,
    serialize: async () => JSON.stringify({ app: 'calendar-studio', v: 1, state }),
    restore: async d => {
      const o = typeof d === 'string' ? JSON.parse(d) : d;
      state = migrate(o && o.state ? o.state : o);
      past = []; future = []; histMeta = []; currentPage = 0;
      if (typeof _holCache !== 'undefined') _holCache = null;
      if (typeof _evCache !== 'undefined') _evCache = null;
      if (typeof _dpiPxCache !== 'undefined') _dpiPxCache.clear();
      if (typeof calEditor !== 'undefined') calEditor.clear();
      syncDocControls(); render(); save(); fit();
      if (typeof closeStart === 'function') closeStart();
      const ra = $('#resumeAsk'); if (ra && !ra.hidden) { ra.hidden = true; document.body.classList.remove('onboarding'); }
    },
    download: (d, name) => downloadBlob(new Blob([d], { type: 'application/json' }), (String(name || 'calendario').replace(/[^\wÀ-ÿ .-]/g, '').trim() || 'calendario') + '.json'),
    hasContent: () => !!(state && state.onboarded),
    docName: () => docName(),
    thumb: async () => { const pages = expand(); if (!pages.length) return ''; await EPArt.ensure(calUsedArt()).catch(() => {}); return EPStudio.svgToDataURL(buildSVG(0, pages[0]), 300); },
  });
  { const _save = save; save = function () { _save.apply(this, arguments); EPProjects.changed(); }; }
  const menuClose = () => { const m = $('#menu'); if (m) m.hidden = true; if (typeof syncScrim === 'function') syncScrim(); };
  { const b = $('#m_projects'); if (b) b.onclick = () => { menuClose(); EPProjects.dialog(); }; }
  { const b = $('#m_saveLocal'); if (b) b.onclick = () => { menuClose(); EPProjects.save(); }; }
  { const b = $('#m_new'); if (b) b.addEventListener('click', () => setTimeout(() => { if (!past.length) EPProjects.detach(); }, 0)); }
  { const b = $('#mx_projects'); if (b) b.onclick = () => EPProjects.dialog(); }
  { const h = $('#ob_projects'); if (h) EPProjects.strip(h); }
  addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); EPProjects.save(); } });
  if (typeof injectIcons === 'function') injectIcons();
})();
