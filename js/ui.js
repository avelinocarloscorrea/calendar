/* Calendar Studio — js/ui.js
   controles do documento, lista de páginas, painel direito, menus, atalhos,
   init. (parte de app; carregado em ordem por index.html) */
"use strict";

/* ================= feedback ================= */
let toastT;
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3600); }
function busy(m) { $('#busyTxt').textContent = m || 'Processando…'; $('#busy').hidden = false; }
function unbusy() { $('#busy').hidden = true; }
const isMobile = () => matchMedia('(max-width:820px)').matches;

const UIKEY = 'calendarstudio-ui-v1';
const uiState = { left: true, right: true };
let zen = false;
const appEl = $('#app');

/* ================= controles do documento (painel esquerdo) ================= */
function updateBindHint() {
  const el = $('#d_bindHint'); if (!el) return;
  const e = bindingEstimate();
  el.textContent = `${e.bindingLabel} · ${pageCount()} página(s) = ${e.sheets} folha(s) · pilha ≈ ${e.thicknessMm.toFixed(1)} mm · ` +
    `garra wire-o ≈ ${e.wireo.label} (${e.wireo.mm} mm, passo ${e.wireo.pitch}) · espiral ≈ ${e.coil.mm} mm. ${e.note}`;
}
function syncDocControls() {
  const s = state.settings;
  const set = (id, v) => { const e = $(id); if (e) e.value = v; };
  const chk = (id, v) => { const e = $(id); if (e) e.checked = !!v; };
  set('#d_size', s.size);
  set('#d_style', s.style);
  const ms = MONTH_STYLES[s.style]; $('#d_styleHint').textContent = ms ? ms.desc : '';
  chk('#d_showCover', s.showCover);
  set('#d_year', s.year);
  set('#d_week', s.weekStart);
  set('#d_uf', s.uf);
  chk('#d_holNacional', s.holNacional);
  chk('#d_holFacultativo', s.holFacultativo);
  chk('#d_holComemorativa', s.holComemorativa);
  set('#d_events', s.events);
  set('#d_ink', s.ink); set('#d_accent', s.accent); set('#d_paperbg', s.paperBg);
  set('#d_binding', s.binding);
  chk('#d_showPunch', s.showPunch);
  chk('#d_printPunch', s.printPunch);
  const bt = BINDING_TYPES[s.binding];
  $('#d_printPunchRow').hidden = !(bt && bt.edge);
  set('#d_bindGsm', s.bindGsm); set('#d_bindKind', s.bindKind);
  updateBindHint();
  const isStand = !!(SIZES[s.size] && SIZES[s.size].stand);
  set('#d_exportMode', s.exportMode);
  set('#d_sheet', s.sheet);
  set('#d_dpi', s.exportDPI);
  $('#d_exportMode').disabled = isStand;
  $('#d_sheetRow').hidden = s.exportMode !== 'fit' || isStand;
  refreshColorFields();
  if (typeof mSync === 'function') mSync();
}
function bindDoc() {
  Object.entries(SIZES).forEach(([k, v]) => $('#d_size').add(new Option(v.label, k)));
  Object.entries(MONTH_STYLES).forEach(([k, v]) => $('#d_style').add(new Option(v.label, k)));
  Object.entries(BINDING_TYPES).forEach(([k, v]) => $('#d_binding').add(new Option(v.label, k)));
  if (typeof EPDates !== 'undefined') EPDates.UFS.forEach(uf => $('#d_uf').add(new Option(uf, uf)));

  const commit = (key, val, opts = {}) => {
    pushHistory();
    state.settings[key] = val;
    state.settings = migrate(state).settings;
    syncDocControls(); render(); save();
    if (opts.fit && !userZoomed) fit();
  };
  $('#d_size').onchange = e => commit('size', e.target.value, { fit: true });
  $('#d_style').onchange = e => commit('style', e.target.value);
  $('#d_showCover').onchange = e => commit('showCover', e.target.checked);
  $('#d_year').onchange = e => commit('year', parseInt(e.target.value, 10));
  $('#d_week').onchange = e => commit('weekStart', e.target.value);
  $('#d_uf').onchange = e => commit('uf', e.target.value);
  ['holNacional', 'holFacultativo', 'holComemorativa'].forEach(k => {
    $('#d_' + k).onchange = e => commit(k, e.target.checked);
  });
  $('#d_events').oninput = e => {
    const el = e.target;
    state.settings.events = sanitizeText(el.value, 8000);
    clearTimeout(el._t); el._t = setTimeout(() => { pushHistory(); state.settings = migrate(state).settings; render(); save(); }, 350);
  };
  $('#d_binding').onchange = e => commit('binding', e.target.value);
  $('#d_showPunch').onchange = e => commit('showPunch', e.target.checked);
  $('#d_printPunch').onchange = e => commit('printPunch', e.target.checked);
  $('#d_bindGsm').onchange = e => { state.settings.bindGsm = +e.target.value; state.settings = migrate(state).settings; save(); updateBindHint(); };
  $('#d_bindKind').onchange = e => { state.settings.bindKind = e.target.value; state.settings = migrate(state).settings; save(); updateBindHint(); };
  $('#d_exportMode').onchange = e => { state.settings.exportMode = e.target.value; state.settings = migrate(state).settings; syncDocControls(); save(); };
  $('#d_sheet').onchange = e => { state.settings.sheet = e.target.value; state.settings = migrate(state).settings; save(); };
  $('#d_dpi').onchange = e => { state.settings.exportDPI = +e.target.value; save(); };
  $('#d_ink').oninput = e => { pushHistory(); state.settings.ink = e.target.value; render(); save(); };
  $('#d_accent').oninput = e => { pushHistory(); state.settings.accent = e.target.value; render(); save(); };
  $('#d_paperbg').oninput = e => { pushHistory(); state.settings.paperBg = e.target.value; render(); save(); };

  const pbox = $('#d_palette');
  Object.entries(PALETTES).forEach(([k, p]) => {
    const bt = document.createElement('button');
    bt.className = 'chip'; bt.dataset.pal = k; bt.title = p.label;
    const s1 = document.createElement('span'), s2 = document.createElement('span');
    s1.className = s2.className = 'palsw';
    s1.style.background = p.ink; s2.style.background = p.accent;
    bt.append(s1, s2, ' ' + p.label);
    bt.onclick = () => {
      pushHistory();
      state.settings.palette = k;
      Object.assign(state.settings, { ink: p.ink, accent: p.accent, paperBg: p.paperBg });
      syncDocControls(); render(); save();
      toast('Paleta: ' + p.label);
    };
    pbox.appendChild(bt);
  });
}

/* ================= modelos ================= */
function renderTemplates() {
  const box = $('#tplList'); if (!box) return;
  box.innerHTML = '';
  TEMPLATES.forEach(t => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tpl-row';
    b.innerHTML = `<b>${esc(t.name)}</b><i>${esc(t.desc)}</i>`;
    b.onclick = () => {
      pushHistory();
      applyTemplate(t);
      syncDocControls(); render(); save();
      if (!userZoomed) fit();
      toast('Modelo: ' + t.name);
    };
    box.appendChild(b);
  });
}

/* ================= lista de páginas (esquerda) ================= */
function pageLabel(pd) {
  if (pd.kind === 'cover') return 'Capa';
  return EPDates.MONTHS_PT[pd.m - 1] + ' ' + state.settings.year;
}
function renderMonthList() {
  const box = $('#monList'); if (!box) return;
  box.innerHTML = '';
  const pages = expand();
  const frag = document.createDocumentFragment();
  pages.forEach((pd, i) => {
    const has = pd.kind === 'cover' ? !!state.settings.coverPhoto : !!(state.months[pd.m - 1] && state.months[pd.m - 1].photo);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'mon-row' + (i === currentPage ? ' on' : '');
    row.innerHTML = `<span class="mon-ic">${iconSVG(pd.kind === 'cover' ? 'bookmark' : 'calendar')}</span>` +
      `<span class="mon-name">${esc(pageLabel(pd))}</span>` +
      (has ? `<span class="mon-dot" title="Tem foto"></span>` : '');
    row.onclick = () => gotoPage(i);
    frag.appendChild(row);
  });
  box.appendChild(frag);
}

/* ================= painel direito (página atual) ================= */
// `mo` é o objeto que guarda {photo, photoSrc, photoEdit} — os meses usam o
// próprio state.months[i]; a capa usa um adaptador com getters/setters em
// cima de state.settings.coverPhoto* (veja fillRight). `aspect` = largura/
// altura da caixa onde a foto vai entrar (pro editor recortar certo).
function renderImageField(container, mo, aspect, title, onChange) {
  container.innerHTML = '';
  const has = !!mo.photo;
  const wrap = document.createElement('span'); wrap.className = 'img-fld';
  if (has) {
    const img = document.createElement('img'); img.className = 'img-prev'; img.alt = 'prévia'; img.src = mo.photo;
    wrap.appendChild(img);
  }
  const row = document.createElement('div'); row.className = 'img-btnrow';
  const pick = document.createElement('button');
  pick.type = 'button'; pick.dataset.i = 'imagedown'; pick.textContent = has ? 'Trocar…' : 'Escolher foto…';
  row.appendChild(pick);
  if (has && mo.photoSrc) {
    const reframeBtn = document.createElement('button');
    reframeBtn.type = 'button'; reframeBtn.dataset.i = 'sliders'; reframeBtn.textContent = 'Reenquadrar';
    reframeBtn.onclick = () => reframe({ aspect, src: mo.photoSrc, edit: mo.photoEdit, title,
      cb: res => { Object.assign(mo, res); onChange(); } });
    row.appendChild(reframeBtn);
  }
  wrap.appendChild(row);
  if (has) {
    const clr = document.createElement('button'); clr.type = 'button'; clr.className = 'img-x danger'; clr.textContent = 'Remover foto';
    clr.onclick = () => { mo.photo = ''; mo.photoSrc = ''; mo.photoEdit = null; onChange(); };
    wrap.appendChild(clr);
  }
  container.appendChild(wrap);
  injectIcons(wrap);
  pick.onclick = () => pickAndEdit({ aspect, title, cb: res => { Object.assign(mo, res); onChange(); } });
}
function coverPhotoAdapter() {
  return {
    get photo() { return state.settings.coverPhoto; }, set photo(v) { state.settings.coverPhoto = v; },
    get photoSrc() { return state.settings.coverPhotoSrc; }, set photoSrc(v) { state.settings.coverPhotoSrc = v; },
    get photoEdit() { return state.settings.coverPhotoEdit; }, set photoEdit(v) { state.settings.coverPhotoEdit = v; },
  };
}
function fillRight() {
  const pd = curPage();
  const isCover = pd && pd.kind === 'cover';
  $('#rightCover').hidden = !isCover;
  $('#rightMonth').hidden = !(pd && pd.kind === 'month');
  const [W, H] = paperWH();
  const onChange = () => { pushHistory(); render(); save(); fillRight(); renderMonthList(); };
  if (isCover) {
    $('#rc_title').value = state.settings.title;
    $('#rc_owner').value = state.settings.owner;
    renderImageField($('#rc_photoFld'), coverPhotoAdapter(), W / H, 'Foto da capa', onChange);
  } else if (pd && pd.kind === 'month') {
    const mo = state.months[pd.m - 1];
    const name = EPDates.MONTHS_PT[pd.m - 1];
    $('#rm_title').textContent = name;
    $('#rm_caption').value = mo.caption;
    const L = monthLayout(state.settings.style, { x: 0, y: 0, w: W, h: H });
    const box = L.photo || L.photoThumb || L.photoFull;
    renderImageField($('#rm_photoFld'), mo, box ? box.w / box.h : W / H, 'Foto de ' + name, onChange);
  }
  if (typeof mSyncRight === 'function') mSyncRight();
}
function bindRight() {
  $('#rc_title').oninput = e => { const el = e.target; state.settings.title = sanitizeText(el.value, 60); clearTimeout(el._t); el._t = setTimeout(() => { pushHistory(); render(); save(); renderMonthList(); }, 250); };
  $('#rc_owner').oninput = e => { const el = e.target; state.settings.owner = sanitizeText(el.value, 60); clearTimeout(el._t); el._t = setTimeout(() => { pushHistory(); render(); save(); }, 250); };
  $('#rm_caption').oninput = e => {
    const pd = curPage(); if (!pd || pd.kind !== 'month') return;
    const el = e.target; state.months[pd.m - 1].caption = sanitizeText(el.value, 120);
    clearTimeout(el._t); el._t = setTimeout(() => { pushHistory(); render(); save(); }, 250);
  };
}

/* ================= seletor de cor (input color -> botão + popover) ================= */
const CF_SW = ['#2f3b37', '#000000', '#3d5c52', '#5b5750', '#8a857a', '#a97f3d', '#b23b2c', '#2b5f8a', '#c8c8c8', '#e5dfd3', '#faf8f3', '#ffffff'];
let cfOpen = null;
function closeCF() { if (cfOpen) { cfOpen.pop.remove(); cfOpen = null; } }
function paintCF(btn, hex) { btn.querySelector('.sw').style.background = hex; btn.querySelector('.hx').textContent = hex; }
function refreshColorFields() { $$('.cf-btn').forEach(b => { const inp = document.getElementById(b.dataset.for); if (inp) paintCF(b, inp.value); }); }
function setupColorFields() {
  $$('input[type=color]').forEach(inp => {
    if (inp.classList.contains('cf-native')) return;
    inp.classList.add('cf-native');
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'cf-btn'; btn.dataset.for = inp.id;
    btn.innerHTML = '<span class="sw"></span><span class="hx"></span>';
    inp.after(btn);
    paintCF(btn, inp.value);
    inp.addEventListener('input', () => paintCF(btn, inp.value));
    btn.addEventListener('click', e => { e.stopPropagation(); openCF(btn, inp); });
  });
}
function openCF(btn, inp) {
  if (cfOpen && cfOpen.input === inp) { closeCF(); return; }
  closeCF();
  const pop = document.createElement('div'); pop.className = 'cfpop';
  const grid = document.createElement('div'); grid.className = 'row1';
  CF_SW.forEach(hex => {
    const s = document.createElement('button'); s.type = 'button'; s.className = 's'; s.style.background = hex; s.title = hex;
    s.onclick = () => { inp.value = hex; inp.dispatchEvent(new Event('input', { bubbles: true })); closeCF(); };
    grid.appendChild(s);
  });
  const custom = document.createElement('button'); custom.type = 'button'; custom.className = 'custom'; custom.textContent = 'Personalizada…';
  custom.onclick = () => { closeCF(); inp.click(); };
  pop.append(grid, custom); document.body.appendChild(pop);
  const r = btn.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.left)) + 'px';
  pop.style.top = (r.bottom + 6 + pop.offsetHeight > innerHeight ? r.top - 6 - pop.offsetHeight : r.bottom + 6) + 'px';
  cfOpen = { pop, input: inp, btn };
}
document.addEventListener('pointerdown', e => { if (cfOpen && !cfOpen.pop.contains(e.target) && !cfOpen.btn.contains(e.target)) closeCF(); });
addEventListener('keydown', e => { if (e.key === 'Escape') closeCF(); }, true);

/* ================= painéis / zen ================= */
function togglePanel(side, on) {
  if (on === undefined) on = !(side === 'left' ? uiState.left : uiState.right);
  if (side === 'left') { uiState.left = on; if (on && isMobile()) uiState.right = false; }
  else { uiState.right = on; if (on && isMobile()) uiState.left = false; }
  applyUI();
}
function applyUI() {
  appEl.classList.toggle('hide-left', !uiState.left);
  appEl.classList.toggle('hide-right', !uiState.right);
  appEl.classList.toggle('zen', zen);
  $('#b_pl').classList.toggle('on', uiState.left && !zen);
  $('#b_pr').classList.toggle('on', uiState.right && !zen);
  $('#b_zen').classList.toggle('on', zen);
  $('#zenExit').hidden = !zen;
  try { localStorage.setItem(UIKEY, JSON.stringify(uiState)); } catch (e) {}
  clearTimeout(applyUI._t); applyUI._t = setTimeout(() => { if (!userZoomed && !isMobile()) fit(); }, 240);
}

/* ================= bind da barra + menu ================= */
// `esc` já vem de pen.js (escopo global compartilhado entre scripts clássicos).
function bindBar() {
  $('#b_undo').onclick = undo; $('#b_redo').onclick = redo;
  $('#b_prev').onclick = () => gotoPage(currentPage - 1);
  $('#b_next').onclick = () => gotoPage(currentPage + 1);
  $('#b_zin').onclick = () => { userZoomed = true; zoom = clamp(zoom + .1, .08, 3); applyZoom(); };
  $('#b_zout').onclick = () => { userZoomed = true; zoom = clamp(zoom - .1, .08, 3); applyZoom(); };
  $('#b_fit').onclick = fit;
  $('#b_pdf').onclick = exportPDF; $('#b_png').onclick = exportPNG;
  $('#b_print').onclick = printDoc;
  $('#b_pl').onclick = () => togglePanel('left');
  $('#b_pr').onclick = () => togglePanel('right');
  $('#b_zen').onclick = () => { zen = !zen; applyUI(); };
  $('#zenExit').onclick = () => { zen = false; applyUI(); };

  const menu = $('#menu');
  const mclose = () => { menu.hidden = true; menuScrim(false); };
  const mtoggle = () => { if (menu.hidden) { menu.hidden = false; menuScrim(true); } else mclose(); };
  $('#b_more').onclick = e => { e.stopPropagation(); mtoggle(); };
  $('#mu_more') && ($('#mu_more').onclick = e => { e.stopPropagation(); mtoggle(); });
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && !(e.target.closest && e.target.closest('#b_more,#mu_more')) && !(e.target.classList && e.target.classList.contains('m-scrim'))) mclose(); });
  $('#m_pdf').onclick = () => { mclose(); exportPDF(); };
  $('#m_png').onclick = () => { mclose(); exportPNG(); };
  $('#m_print').onclick = () => { mclose(); printDoc(); };
  $('#m_new').onclick = () => { mclose(); if (confirm('Começar um novo calendário? O atual será descartado.')) { newDoc(); syncDocControls(); render(); save(); fit(); toast('Novo calendário.'); } };
  $('#m_save').onclick = () => { mclose(); exportProject(); };
  $('#m_open').onclick = () => { mclose(); $('#file_open').click(); };
  $('#m_help').onclick = () => { mclose(); $('#help').showModal(); };
  $('#m_privacy').onclick = () => { mclose(); $('#privacy').showModal(); };
  $('#m_about').onclick = () => { mclose(); $('#about').showModal(); };
  $('#m_install') && ($('#m_install').onclick = () => { mclose(); if (typeof doInstall === 'function') doInstall(); });
  $$('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
  $('#p_wipe').onclick = () => { if (confirm('Apagar o calendário e as configurações guardadas neste navegador?')) { try { localStorage.removeItem(KEY); localStorage.removeItem(UIKEY); } catch (e) {} newDoc(); syncDocControls(); render(); save(); try { $('#privacy').close(); } catch (e) {} toast('Tudo apagado.'); } };
  $('#file_open').addEventListener('change', e => { if (e.target.files[0]) importProject(e.target.files[0]); e.target.value = ''; });

  if (ACERVO_URL) {
    const bl = $('#brandLink'); bl.href = ACERVO_URL; bl.target = '_blank';
    const ma = $('#m_acervo'); if (ma) { ma.href = ACERVO_URL; ma.target = '_blank'; ma.hidden = false; }
  }
}
let _menuScrimEl = null;
function menuScrim(on) {
  if (on && isMobile()) {
    if (!_menuScrimEl) {
      _menuScrimEl = document.createElement('div'); _menuScrimEl.className = 'm-scrim';
      document.body.appendChild(_menuScrimEl);
      _menuScrimEl.addEventListener('pointerdown', () => { const m = $('#menu'); if (m) m.hidden = true; menuScrim(false); });
    }
  } else if (_menuScrimEl) { _menuScrimEl.remove(); _menuScrimEl = null; }
}

/* ================= eventos globais ================= */
function bindGlobal() {
  addEventListener('scroll', e => {
    const el = e.target;
    if (el instanceof Element && el.classList.contains('scrl')) { el.classList.add('is-scrolling'); clearTimeout(el._sT); el._sT = setTimeout(() => el.classList.remove('is-scrolling'), 1400); }
  }, true);

  const pageAt = t => { const pg = t.closest && t.closest('.page'); if (!pg) return -1; return [...sheetsEl.children].indexOf(pg); };
  sheetsEl.addEventListener('click', e => { const i = pageAt(e.target); if (i >= 0 && i !== currentPage) gotoPage(i); });

  stage.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016)); }, { passive: false });
  let _pan = null;
  stage.addEventListener('pointerdown', e => {
    if (e.button !== 1) return; e.preventDefault();
    _pan = { x: e.clientX, y: e.clientY, sl: stage.scrollLeft, st: stage.scrollTop };
    try { stage.setPointerCapture(e.pointerId); } catch (_) {} document.body.classList.add('panning');
  }, true);
  stage.addEventListener('pointermove', e => { if (!_pan) return; stage.scrollLeft = _pan.sl - (e.clientX - _pan.x); stage.scrollTop = _pan.st - (e.clientY - _pan.y); });
  const endPan = e => { if (!_pan) return; _pan = null; document.body.classList.remove('panning'); try { stage.releasePointerCapture(e.pointerId); } catch (_) {} };
  stage.addEventListener('pointerup', endPan); stage.addEventListener('pointercancel', endPan);

  let _scT = 0;
  stage.addEventListener('scroll', () => {
    const n = pageCount(); if (n < 2) return;
    const mid = stage.scrollTop + stage.clientHeight / 2;
    let best = 0, bd = 1e9;
    [...sheetsEl.children].forEach((pg, i) => { const c = pg.offsetTop * zoom + pg.offsetHeight * zoom / 2; const d = Math.abs(c - mid); if (d < bd) { bd = d; best = i; } });
    if (best !== currentPage) {
      currentPage = best;
      if (!_scT) _scT = requestAnimationFrame(() => { _scT = 0; render(); });
    }
  });

  let _pinch = null;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  stage.addEventListener('touchstart', e => { if (e.touches.length === 2) _pinch = { d: dist(e.touches) }; }, { passive: true });
  stage.addEventListener('touchmove', e => {
    if (!_pinch || e.touches.length !== 2) return; e.preventDefault();
    const d = dist(e.touches), cx = (e.touches[0].clientX + e.touches[1].clientX) / 2, cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    if (_pinch.d > 0 && d > 0) zoomAt(cx, cy, d / _pinch.d); _pinch.d = d;
  }, { passive: false });
  const endPinch = e => { if (_pinch && (!e.touches || e.touches.length < 2)) _pinch = null; };
  stage.addEventListener('touchend', endPinch); stage.addEventListener('touchcancel', endPinch);

  addEventListener('keydown', e => {
    const t = e.target, typing = t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); printDoc(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) { e.preventDefault(); redo(); return; }
    if (e.key === 'Escape') {
      if (!$('#menu').hidden) { $('#menu').hidden = true; menuScrim(false); return; }
      if (zen) { zen = false; applyUI(); return; }
    }
    if (typing) return;
    if (e.key === '[') { togglePanel('left'); e.preventDefault(); }
    else if (e.key === ']') { togglePanel('right'); e.preventDefault(); }
    else if (e.key === '.') { zen = !zen; applyUI(); e.preventDefault(); }
    else if (e.key === 'PageDown' || e.key === 'ArrowDown') { gotoPage(currentPage + 1); e.preventDefault(); }
    else if (e.key === 'PageUp' || e.key === 'ArrowUp') { gotoPage(currentPage - 1); e.preventDefault(); }
  });
  addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); document.body.classList.add('dropping'); } });
  addEventListener('dragleave', e => { if (e.relatedTarget === null) document.body.classList.remove('dropping'); });
  addEventListener('drop', e => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f && /\.json$/i.test(f.name)) { e.preventDefault(); document.body.classList.remove('dropping'); importProject(f); }
  });
  let rT; addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { applyUI(); if (!userZoomed) fit(); }, 150); });
}

/* ================= init ================= */
(function init() {
  injectIcons();
  try {
    const u = JSON.parse(localStorage.getItem(UIKEY) || 'null');
    if (u && typeof u === 'object') { uiState.left = u.left !== false; uiState.right = u.right !== false; }
    else if (innerWidth < 1200) { uiState.right = false; if (innerWidth < 980) uiState.left = false; }
  } catch (e) {}
  if (isMobile()) { uiState.left = false; uiState.right = false; }
  bindDoc(); bindRight(); bindBar(); bindGlobal();
  renderTemplates();
  if (typeof mSetup === 'function') mSetup();
  if (typeof initInstall === 'function') initInstall();
  setupColorFields();
  load();
  syncDocControls();
  applyUI();
  render();
  fit();
  injectIcons();
})();
