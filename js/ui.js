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
  const eff = effectiveExportMode();
  $('#d_sheetRow').hidden = s.exportMode !== 'fit' || isStand;
  const hint = $('#d_exportHint');
  if (hint) {
    const [W, H] = paperWH();
    const now = isStand
      ? 'A mesa cavalete sai com o dobro da altura: face em cima, apoio embaixo, dobra no meio.'
      : eff.mode === 'fit'
        ? `Sai centralizado numa folha ${eff.sheet === 'a3' ? 'A3' : 'A4'} (${W.toFixed(0)}×${H.toFixed(0)} mm) com <b>marcas de corte</b>.`
        : `Sai no tamanho exato: ${W.toFixed(0)}×${H.toFixed(0)} mm, sem marca de corte.`;
    const auto = s.exportMode === 'auto' ? '<b>Automático</b> ajusta sozinho ao tamanho da folha. ' : '';
    hint.innerHTML = `${auto}${now} Imprima em <b>100%</b>, sem margens.`;
  }
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
  fillTplGrid($('#tplList'), onboard => { if (onboard) exitOnboarding(); });
  fillTplGrid($('#tplListOb'), () => exitOnboarding());
}
function fillTplGrid(box, afterApply) {
  if (!box) return;
  box.innerHTML = '';
  TEMPLATES.forEach(t => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tpl-card';
    b.innerHTML = `<span class="tpl-card__thumb">${tplThumbSVG(t)}</span>
      <span class="tpl-card__name">${esc(t.name)}</span>
      <span class="tpl-card__desc">${esc(t.desc)}</span>`;
    b.onclick = () => {
      pushHistory();
      applyTemplate(t);
      syncDocControls(); render(); save();
      if (!userZoomed) fit();
      toast('Modelo: ' + t.name);
      if (afterApply) afterApply(true);
    };
    box.appendChild(b);
  });
}

/* ============ miniatura gráfica do modelo (painel "Modelos") ============
   Reflete de fato tamanho/proporção real (SIZES), paleta de cor (PALETTES),
   posição da foto do estilo escolhido (MONTH_STYLES) e a encadernação — não
   é um ícone genérico por trás do nome. */
function tplThumbSVG(t) {
  const s = t.settings || {};
  const sz = SIZES[s.size] || SIZES.a4p;
  const pal = PALETTES[s.palette] || PALETTES.esmeralda;
  const bind = BINDING_TYPES[s.binding] || BINDING_TYPES.none;
  const W = 100, H = Math.round(W * (sz.h / sz.w));
  const R = 5;
  // margem reservada para a encadernação (topo/esquerda), como no documento real
  const bindPad = bind.edge === 'top' ? 8 : bind.edge === 'left' ? 8 : 0;
  const ax = bindPad && bind.edge === 'left' ? bindPad : 0;
  const ay = bindPad && bind.edge === 'top' ? bindPad : 0;
  const cw = W - ax, ch = H - ay;
  const photo = `fill="${pal.accent}" opacity=".55"`;
  let scene = '';
  const style = s.style || 'sografe';
  if (style === 'fotofundo') {
    scene += `<rect x="${ax}" y="${ay}" width="${cw}" height="${ch}" ${photo}/>`;
    scene += `<rect x="${ax + cw * 0.08}" y="${ay + ch * 0.42}" width="${cw * 0.84}" height="${ch * 0.5}" rx="2" fill="${pal.paperBg}" opacity=".88"/>`;
    scene += tplGrid(ax + cw * 0.13, ay + ch * 0.48, cw * 0.74, ch * 0.38, pal.ink);
  } else if (style === 'fototopo') {
    scene += `<rect x="${ax}" y="${ay}" width="${cw}" height="${ch * 0.42}" ${photo}/>`;
    scene += tplGrid(ax + cw * 0.06, ay + ch * 0.5, cw * 0.88, ch * 0.42, pal.ink);
  } else if (style === 'fotolado') {
    scene += `<rect x="${ax}" y="${ay}" width="${cw * 0.34}" height="${ch}" ${photo}/>`;
    scene += tplGrid(ax + cw * 0.42, ay + ch * 0.08, cw * 0.52, ch * 0.84, pal.ink);
  } else if (style === 'fotocanto') {
    scene += tplGrid(ax + cw * 0.06, ay + ch * 0.06, cw * 0.88, ch * 0.88, pal.ink);
    scene += `<rect x="${ax + cw * 0.06}" y="${ay + ch * 0.06}" width="${cw * 0.26}" height="${ch * 0.2}" rx="1.5" ${photo}/>`;
  } else if (style === 'moldura') {
    scene += `<rect x="${ax}" y="${ay}" width="${cw}" height="${ch}" ${photo}/>`;
    scene += `<rect x="${ax + 3}" y="${ay + 3}" width="${cw - 6}" height="${ch - 6}" fill="none" stroke="${pal.paperBg}" stroke-width="1.4"/>`;
    scene += `<rect x="${ax + cw * 0.16}" y="${ay + ch * 0.34}" width="${cw * 0.68}" height="${ch * 0.44}" rx="2" fill="${pal.paperBg}" opacity=".92"/>`;
    scene += tplGrid(ax + cw * 0.21, ay + ch * 0.4, cw * 0.58, ch * 0.32, pal.ink);
  } else { // sografe
    scene += `<rect x="${ax}" y="${ay}" width="${cw}" height="${ch * 0.16}" fill="${pal.ink}" opacity=".85"/>`;
    scene += tplGrid(ax + cw * 0.07, ay + ch * 0.24, cw * 0.86, ch * 0.68, pal.ink);
  }
  let bindMarks = '';
  if (bind.edge === 'top') {
    const n = 6, gap = W / (n + 1);
    for (let i = 1; i <= n; i++) bindMarks += `<circle cx="${(gap * i).toFixed(1)}" cy="${bindPad / 2}" r="1.3" fill="#fff" stroke="rgba(0,0,0,.3)" stroke-width=".5"/>`;
  } else if (bind.edge === 'left') {
    const n = 5, gap = H / (n + 1);
    for (let i = 1; i <= n; i++) bindMarks += `<circle cx="${bindPad / 2}" cy="${(gap * i).toFixed(1)}" r="1.3" fill="#fff" stroke="rgba(0,0,0,.3)" stroke-width=".5"/>`;
  } else if (s.binding === 'corner') {
    bindMarks += `<path d="M${W - 10} 0 L${W} 0 L${W} 10 Z" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1"/>`;
  }
  const cid = 'tc-' + t.id;
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <defs><clipPath id="${cid}"><rect x="0" y="0" width="${W}" height="${H}" rx="${R}"/></clipPath></defs>
    <g clip-path="url(#${cid})">
      <rect x="0" y="0" width="${W}" height="${H}" fill="${pal.paperBg}"/>
      ${scene}${bindMarks}
      <rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="${R}" fill="none" stroke="rgba(0,0,0,.12)" stroke-width="1"/>
    </g>
  </svg>`;
}
function tplGrid(x, y, w, h, ink) {
  const cols = 7, rows = 5, gap = 1;
  const cw = (w - gap * (cols - 1)) / cols, ch = (h - gap * (rows - 1)) / rows;
  let out = '';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
    out += `<rect x="${(x + c * (cw + gap)).toFixed(1)}" y="${(y + r * (ch + gap)).toFixed(1)}" width="${cw.toFixed(1)}" height="${ch.toFixed(1)}" fill="none" stroke="${ink}" stroke-width=".6" opacity=".55"/>`;
  return out;
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
// altura da caixa onde a foto vai entrar. `key` identifica o campo (ex.:
// 'cover' ou 'month:3') — junto com a fonte, é o que EPImgEdit.mount() usa
// pra saber que já está editando a MESMA foto e não precisa desmontar nada
// (senão um arraste em andamento seria interrompido a cada render()).
// Sem popup — o editor fica embutido aqui, igual ao painel do Polaroide
// Studio: os controles editam a foto ao vivo, o ajuste é salvo sozinho
// quando o gesto termina (soltar o arraste/slider).
function renderImageField(container, mo, aspect, key) {
  const onCommit = res => { mo.photo = res.dataURL; mo.photoEdit = res.edit; render(); save(); renderMonthList(); };
  if (!mo.photoSrc) {
    let btn = container.querySelector('.img-empty-pick');
    if (!btn) {
      container.innerHTML = '';
      btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'wfull img-empty-pick'; btn.dataset.i = 'imagedown'; btn.textContent = 'Escolher foto…';
      container.appendChild(btn);
      injectIcons(container);
    }
    btn.onclick = () => pickNewPhoto({ key, cb: res => { Object.assign(mo, res); pushHistory(); render(); save(); fillRight(); renderMonthList(); } });
    return;
  }
  let host = container.querySelector('.img-editHost');
  if (!host) {
    container.innerHTML = '<div class="img-btnrow"><button type="button" data-pick>Trocar foto…</button><button type="button" class="img-x danger" data-clr>Remover foto</button></div><div class="img-editHost"></div>';
    injectIcons(container);
    host = container.querySelector('.img-editHost');
  }
  container.querySelector('[data-pick]').onclick = () => pickNewPhoto({ key, keepEdit: mo.photoEdit,
    cb: res => { Object.assign(mo, res); pushHistory(); render(); save(); fillRight(); renderMonthList(); } });
  container.querySelector('[data-clr]').onclick = () => {
    pushHistory(); mo.photo = ''; mo.photoSrc = ''; mo.photoEdit = null; render(); save(); fillRight(); renderMonthList();
  };
  EPImgEdit.mount(host, { key, src: mo.photoSrc, aspect, edit: mo.photoEdit, onHistoryPoint: pushHistory, onCommit });
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
  if (isCover) {
    $('#rc_title').value = state.settings.title;
    $('#rc_owner').value = state.settings.owner;
    renderImageField($('#rc_photoFld'), coverPhotoAdapter(), W / H, 'cover');
  } else if (pd && pd.kind === 'month') {
    const mo = state.months[pd.m - 1];
    const name = EPDates.MONTHS_PT[pd.m - 1];
    $('#rm_title').textContent = name;
    $('#rm_caption').value = mo.caption;
    const L = monthLayout(state.settings.style, { x: 0, y: 0, w: W, h: H });
    const box = L.photo || L.photoThumb || L.photoFull;
    renderImageField($('#rm_photoFld'), mo, box ? box.w / box.h : W / H, 'month:' + pd.m);
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
  $('#m_new').onclick = () => { mclose(); if (confirm('Começar um novo calendário? O atual será descartado.')) { newDoc(); syncDocControls(); render(); save(); fit(); enterOnboarding(); } };
  $('#m_save').onclick = () => { mclose(); exportProject(); };
  $('#m_open').onclick = () => { mclose(); $('#file_open').click(); };
  $('#m_help').onclick = () => { mclose(); $('#help').showModal(); };
  $('#m_privacy').onclick = () => { mclose(); $('#privacy').showModal(); };
  $('#m_about').onclick = () => { mclose(); $('#about').showModal(); };
  $('#m_install') && ($('#m_install').onclick = () => { mclose(); if (typeof doInstall === 'function') doInstall(); });
  $$('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
  $('#p_wipe').onclick = () => { if (confirm('Apagar o calendário e as configurações guardadas neste navegador?')) { try { localStorage.removeItem(KEY); localStorage.removeItem(UIKEY); } catch (e) {} newDoc(); syncDocControls(); render(); save(); try { $('#privacy').close(); } catch (e) {} enterOnboarding(); } };
  $('#file_open').addEventListener('change', e => { if (e.target.files[0]) importProject(e.target.files[0]); e.target.value = ''; });

  if (ACERVO_URL) {
    const bl = $('#brandLink'); bl.href = ACERVO_URL; bl.target = '_blank';
    const ma = $('#m_acervo'); if (ma) { ma.href = ACERVO_URL; ma.target = '_blank'; ma.hidden = false; }
  }
  if (typeof FEEDBACK_URL !== 'undefined' && FEEDBACK_URL) {
    const mf = $('#m_feedback'); if (mf) { mf.href = FEEDBACK_URL; mf.target = '_blank'; mf.hidden = false; }
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
  const hasSaved = !!state.onboarded;
  let alreadyAsked = false;
  try { alreadyAsked = sessionStorage.getItem('calendarstudio-resumed') === '1'; } catch (e) {}
  if (hasSaved && !alreadyAsked) showResumeAsk(); else finishInit();
  function finishInit() { syncDocControls(); applyUI(); render(); fit(); injectIcons(); }
  function markAsked() { try { sessionStorage.setItem('calendarstudio-resumed', '1'); } catch (e) {} }
  function showResumeAsk() {
    const box = $('#resumeAsk'); if (!box) { finishInit(); return; }
    const withPhoto = state.months.filter(m => m.photo).length;
    $('#ra_desc').textContent = `Encontramos um calendário salvo neste navegador — ${state.settings.year}` + (withPhoto ? `, ${withPhoto} ${withPhoto === 1 ? 'mês' : 'meses'} com foto.` : '.');
    box.hidden = false;
    document.body.classList.add('onboarding');
    $('#ra_continue').onclick = () => { markAsked(); box.hidden = true; document.body.classList.remove('onboarding'); finishInit(); };
    $('#ra_new').onclick = () => {
      if (!confirm('Começar um novo calendário? O salvo continuará guardado até você mudar algo.')) return;
      markAsked(); box.hidden = true;
      newDoc(); syncDocControls(); render(); save(); fit();
      enterOnboarding();
    };
  }
})();
