/* Calendar Studio — js/shell-ui.js
   Casca de interface: trilho de abas, etapas da barra (Modelo → Fotos →
   Imprimir), fotos em lote, estilos de mês em cartões visuais, galeria de
   modelos com miniaturas desenhadas pelo próprio motor e o diálogo
   "Imprimir e baixar" com a prévia real da folha e a verificação antes de
   imprimir (meses sem foto, resolução baixa, cavalete…).
   Carregado por último; só liga peças novas nos ids/funções existentes. */
"use strict";

const SH_ICON = {
  auto: '<path d="M5 19L15 9"/><path d="M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 11l.7 1.3L21 13l-1.3.7L19 15l-.7-1.3L17 13l1.3-.7z"/>',
  fit: '<rect x="7" y="6" width="10" height="12" rx="1"/><path d="M3 6h2M6 3v2M19 6h2M18 3v2M3 18h2M6 19v2M19 18h2M18 19v2"/>',
  real: '<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>',
  wand: '<path d="M4 20l10-10"/><path d="M15 3v3M13.5 4.5h3M19 8v2M18 9h2M9 3v2M8 4h2"/>',
};
const shIcon = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SH_ICON[n]}</svg>`;
const sizeShort = key => { const z = SIZES[key]; return z ? z.label.split(' — ')[0] : ''; };

/* ================= trilho ================= */
EPShell.initRail({
  rail: $('#rail'), panes: $('#panes'), storageKey: 'calendarstudio-pane', initial: 'paginas',
  isCollapsed: () => !isMobile() && !uiState.left,
  onCollapse: hide => { if (!isMobile()) togglePanel('left', !hide); },
});
function showPane(id) {
  const b = $(`#rail [data-pane="${id}"]`); if (!b) return;
  if (!uiState.left && !isMobile()) togglePanel('left', true);
  if (!b.classList.contains('on')) b.click();
  if (isMobile() && typeof mOpenTab === 'function') mOpenTab('documento');
}
setMonView(true);

/* ================= etapas ================= */
function setStep(k) {
  ['st_model', 'st_edit', 'st_print'].forEach((id, i) => {
    const b = $('#' + id); if (!b) return;
    b.classList.toggle('on', i === k); b.classList.toggle('done', i < k);
  });
}
$('#st_model').onclick = () => openStart();
$('#st_edit').onclick = () => { const d = $('#exportDlg'); if (d.open) d.close(); closeStart(); };
$('#st_print').onclick = () => openExportDlg();

/* ================= fotos de exemplo (só para miniaturas) =================
   Paisagens geradas num <canvas> — nada é baixado. Deixam as miniaturas dos
   modelos com cara de calendário de verdade sem depender de foto nenhuma. */
const SAMPLE_SKIES = [
  ['#f6d8b6', '#e9a07a', '#6f8f7e', '#44604f'], ['#cfe3ee', '#9ec3d6', '#7c9a86', '#4d6a58'],
  ['#fbe3c4', '#f2b38d', '#a7876b', '#6e5745'], ['#dfe9dc', '#b6cfae', '#6d8d68', '#3f5a3f'],
  ['#e8dff0', '#c4b3d8', '#8a7a96', '#564a63'], ['#fdf0d8', '#f5c98e', '#c48a5a', '#7d573a'],
];
let _samples = null;
function samplePhotos() {
  if (_samples) return _samples;
  _samples = SAMPLE_SKIES.map((c, i) => {
    const cv = document.createElement('canvas'); cv.width = 480; cv.height = 360;
    const g = cv.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, 360); sky.addColorStop(0, c[0]); sky.addColorStop(1, c[1]);
    g.fillStyle = sky; g.fillRect(0, 0, 480, 360);
    g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(120 + i * 45, 110, 34, 0, Math.PI * 2); g.fill();
    const hill = (y, amp, col, ph) => {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, 360);
      for (let x = 0; x <= 480; x += 12) g.lineTo(x, y + Math.sin(x / 70 + ph) * amp + Math.sin(x / 23 + ph * 2) * amp * 0.25);
      g.lineTo(480, 360); g.closePath(); g.fill();
    };
    hill(220, 22, c[2], i); hill(270, 16, c[3], i + 2);
    return cv.toDataURL('image/jpeg', 0.8);
  });
  return _samples;
}

/* ================= galeria ================= */
const TPL_CATS = [{ id: 'parede', label: 'Parede' }, { id: 'mesa', label: 'Mesa e ímã' }];
const TPL_CAT = { 'parede-min': 'parede', 'parede-fotos': 'parede', poster: 'parede', quadrado: 'parede', 'editorial-pb': 'parede', 'mesa-exec': 'mesa', cavalete: 'mesa', ima: 'mesa' };

function withTemplateState(t, fn, opts = {}) {
  const saved = state;
  try {
    state = newState();
    applyTemplate(t);
    state.settings.title = 'Calendário';
    if (opts.photos && state.settings.style !== 'sografe') {
      const ph = samplePhotos();
      state.months.forEach((mo, i) => { mo.photo = ph[i % ph.length]; });
      state.settings.coverPhoto = ph[0];
    }
    return fn();
  } finally { state = saved; }
}
function pageSVGFor(pd, idx) {
  const [W, H] = paperWH();
  const pen = SvgPen(W, H, { bg: state.settings.paperBg });
  drawPageInto(pen, pd, idx, { screen: false });
  return pen.svg();
}
function pairThumbHTML(front, back, W, H) {
  const pg = (svg, cls) => `<span class="tt-pg ${cls}" data-ar="${(W / H).toFixed(4)}" data-land="${W / H > 1.05 ? 1 : 0}">${svg}</span>`;
  return `<span class="tt">${back ? pg(back, 'tt-back') : ''}${pg(front, 'tt-front')}</span>`;
}
function layoutPairThumb(host) {
  const pgs = host.querySelectorAll('.tt-pg'), two = pgs.length > 1;
  pgs.forEach(el => {
    const ar = +el.dataset.ar, land = el.dataset.land === '1';
    el.style.aspectRatio = String(ar);
    if (land) el.style.width = two ? '64%' : '76%'; else el.style.height = two ? '80%' : '84%';
    if (!two) { el.style.left = '50%'; el.style.top = '50%'; el.style.transform = 'translate(-50%,-50%)'; return; }
    if (el.classList.contains('tt-back')) { el.style.right = '10%'; el.style.top = '7%'; el.style.transform = 'rotate(3deg)'; }
    else { el.style.left = '10%'; el.style.bottom = '7%'; }
  });
}
new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(nd => {
  if (nd.nodeType !== 1) return;
  if (nd.classList.contains('tt')) layoutPairThumb(nd);
  else nd.querySelectorAll && nd.querySelectorAll('.tt').forEach(layoutPairThumb);
}))).observe(document.body, { childList: true, subtree: true });

function templateThumb(t) {
  return withTemplateState(t, () => {
    const pages = expand(); const [W, H] = paperWH();
    const now = new Date().getMonth();
    const month = pages.find(p => p.kind === 'month' && p.m === now + 1) || pages.find(p => p.kind === 'month');
    const first = pages[0];
    const front = pageSVGFor(first, 0);
    const back = month && month !== first ? pageSVGFor(month, pages.indexOf(month)) : null;
    // cavalete: a face só
    return pairThumbHTML(front, back, W, H);
  }, { photos: true });
}
function galleryItems(forPanel) {
  const items = [];
  if (!forPanel) items.push({ id: '_wiz', name: 'Montar passo a passo', desc: 'Tamanho, estilo do mês, cores e acabamento em 4 escolhas.', variant: 'wizard', always: true, thumb: () => `<span class="tt-ic"><span>${shIcon('wand')}</span></span>` });
  TEMPLATES.forEach(t => items.push({
    id: t.id, name: t.name, desc: t.desc, cat: TPL_CAT[t.id] || 'parede', tpl: t,
    meta: `${sizeShort(t.settings.size)}${t.settings.showCover === false ? '' : ' · com capa'}`,
    thumb: () => templateThumb(t),
  }));
  return items;
}
function pickTemplate(it) {
  if (it.id === '_wiz') { if (typeof showWizardPane === 'function') showWizardPane(); $('#onboard').scrollTop = 0; return; }
  const t = it.tpl; if (!t) return;
  pushHistory();
  applyTemplate(t);
  syncDocControls(); render(); save();
  if (typeof exitOnboarding === 'function') exitOnboarding();
  setStep(1);
  requestAnimationFrame(() => { if (!userZoomed) fit(); });
  const needs = state.settings.style !== 'sografe' && !state.months.some(m => m.photo);
  toast(needs ? `"${t.name}" pronto. Agora é só adicionar as fotos.` : `"${t.name}" aplicado.`);
  if (needs && !isMobile()) showPane('paginas');
}
EPShell.gallery({ grid: $('#tplListOb'), filters: $('#tplFilters'), categories: TPL_CATS, items: galleryItems(false), onPick: pickTemplate });
EPShell.gallery({ grid: $('#tplList'), items: galleryItems(true), onPick: pickTemplate });
$('#tplList').className = 'ep-tpls ep-tpls--panel';
// ui.js recria as listas antigas em renderTemplates(); a galeria nova manda
renderTemplates = function () {};

function openStart() {
  const d = $('#exportDlg'); if (d.open) d.close();
  if (typeof showTemplatesPane === 'function') showTemplatesPane();
  stage.scrollTop = 0;
  $('#onboard').hidden = false;
  $('#ob_close').hidden = false;
  document.body.classList.add('onboarding');
  setStep(0);
}
function closeStart() {
  if (!state.onboarded) return;
  $('#onboard').hidden = true;
  document.body.classList.remove('onboarding');
  setStep(1);
  requestAnimationFrame(() => { if (!userZoomed) fit(); });
}
$('#ob_close').onclick = closeStart;
$('#ob_open').onclick = e => { e.preventDefault(); $('#file_open').click(); };
{ const _exit = exitOnboarding; exitOnboarding = function () { _exit(); setStep(1); }; }

document.addEventListener('photos-restored', () => { _styleSig = ''; syncStyleCards(); const ra = $('#resumeAsk'); if (ra && !ra.hidden) resumeThumb(); });
function resumeThumb() {
  const ra = $('#resumeAsk'); if (!ra || ra.hidden) return;
  const pages = expand(); const [W, H] = paperWH();
  const month = pages.find(p => p.kind === 'month' && state.months[p.m - 1].photo) || pages.find(p => p.kind === 'month');
  $('#ra_thumb').innerHTML = pairThumbHTML(pageSVGFor(pages[0], 0), month && month !== pages[0] ? pageSVGFor(month, pages.indexOf(month)) : null, W, H);
  const n = state.months.filter(m => m.photo).length;
  $('#ra_desc').innerHTML = `<b>${esc(state.settings.title || 'Calendário')} ${state.settings.year}</b> · ${esc(sizeShort(state.settings.size))} · ${n} ${n === 1 ? 'mês' : 'meses'} com foto.`;
}
resumeThumb();

/* ================= estilos de mês em cartões visuais ================= */
function buildStyleCards() {
  const box = $('#styleCards'); if (!box) return;
  box.innerHTML = '';
  Object.entries(MONTH_STYLES).forEach(([k, v]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'style-card' + (state.settings.style === k ? ' on' : ''); b.dataset.v = k;
    const svg = withTemplateState({ settings: { ...state.settings, style: k } }, () => {
      const [W, H] = paperWH();
      const pen = SvgPen(W, H, { bg: state.settings.paperBg });
      drawPageInto(pen, { kind: 'month', m: new Date().getMonth() + 1 }, 1, { screen: false });
      return pen.svg();
    }, { photos: true });
    b.innerHTML = `<span class="style-card__pv">${svg}</span><span class="style-card__lb">${esc(v.label)}</span>`;
    b.onclick = () => { const sel = $('#d_style'); if (sel.value === k) return; sel.value = k; sel.dispatchEvent(new Event('change', { bubbles: true })); };
    box.appendChild(b);
  });
}
let _styleSig = '';
function syncStyleCards() {
  const s = state.settings, sig = [s.size, s.ink, s.accent, s.paperBg, s.binding, s.year, s.weekStart].join('|');
  if (sig !== _styleSig) { _styleSig = sig; buildStyleCards(); return; }
  $$('#styleCards .style-card').forEach(b => b.classList.toggle('on', b.dataset.v === s.style));
}

/* ================= fotos em lote ================= */
$('#cal_batch').onclick = () => $('#file_batch').click();
$('#file_batch').addEventListener('change', async e => {
  const files = [...(e.target.files || [])].filter(f => /^image\//.test(f.type)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }));
  e.target.value = '';
  if (!files.length) return;
  await addPhotosBatch(files);
});
async function addPhotosBatch(files) {
  let slots = state.months.map((mo, i) => i).filter(i => !state.months[i].photoSrc);
  if (!slots.length) {
    if (!confirm('Todos os meses já têm foto. Substituir a partir de Janeiro?')) return;
    slots = state.months.map((_, i) => i);
  }
  const [W, H] = paperWH();
  const L = monthLayout(state.settings.style, { x: 0, y: 0, w: W, h: H });
  const box = L.photo || L.photoThumb || L.photoFull || { w: W, h: H };
  const aspect = box.w / box.h;
  const om = outMaxFor(box.w, box.h);
  const [ow, oh] = aspect >= 1 ? [om, Math.round(om / aspect)] : [Math.round(om * aspect), om];
  pushHistory();
  let done = 0, fail = 0;
  const useCover = state.settings.showCover && !state.settings.coverPhotoSrc && files.length > slots.length;
  const list = files.slice(0, slots.length + (useCover ? 1 : 0));
  for (let i = 0; i < list.length; i++) {
    busy(`Preparando foto ${i + 1} de ${list.length}…`);
    try {
      const src = await readAndSanitize(list[i]);
      const img = await EPImgEdit.loadImage(src);
      const edit = EPImgEdit.normEdit(null);
      if (useCover && i === list.length - 1) {
        const cm = outMaxFor(W, H);
        const [cw, ch] = W / H >= 1 ? [cm, Math.round(cm * H / W)] : [Math.round(cm * W / H), cm];
        Object.assign(state.settings, { coverPhotoSrc: src, coverPhotoEdit: edit, coverPhoto: EPImgEdit.bakeDataURL(img, edit, cw, ch) });
      } else {
        const mo = state.months[slots[i]];
        Object.assign(mo, { photoSrc: src, photoEdit: edit, photo: EPImgEdit.bakeDataURL(img, edit, ow, oh) });
      }
      done++;
    } catch (err) { console.error(err); fail++; }
  }
  unbusy();
  if (state.settings.style === 'sografe' && done) {
    $('#d_style').value = 'fototopo'; state.settings.style = 'fototopo';
    toast('Estilo trocado para "Foto no topo" para as fotos aparecerem.');
  }
  render(); save(); syncDocControls();
  const extra = files.length - list.length;
  toast(`${done} foto(s) adicionada(s)` + (fail ? ` · ${fail} com erro` : '') + (extra > 0 ? ` · ${extra} sobraram (sem mês livre)` : '') + '. Clique num mês para enquadrar.');
}

/* ================= Imprimir e baixar ================= */
let xpIdx = 0, xpCards = null, xpSheetSeg = null, xpColorSeg = null;
function xpSetup() {
  if (xpCards) return;
  xpCards = EPShell.optionCards($('#xp_modes'), $('#d_exportMode'), [
    { v: 'auto', title: 'Automático', badge: 'recomendado', icon: shIcon('auto'), desc: () => {
      const old = state.settings.exportMode; state.settings.exportMode = 'auto';
      const e = effectiveExportMode(); state.settings.exportMode = old;
      return `Escolhe sozinho. Para este tamanho: <b>${e.mode === 'fit' ? 'folha A4 com marcas de corte' : 'tamanho exato'}</b>.`;
    } },
    { v: 'fit', title: 'Em casa · folha com marcas de corte', icon: shIcon('fit'), desc: 'Página centralizada numa A4 ou A3, com marcas nos cantos para cortar.' },
    { v: 'real', title: 'Gráfica · tamanho exato', icon: shIcon('real'), desc: 'Cada página no tamanho final do calendário.' },
  ]);
  xpSheetSeg = EPShell.segmented($('#xp_sheet'), $('#d_sheet'));
  xpColorSeg = EPShell.segmented($('#xp_color'), $('#d_pdfColor'));
  let t;
  $('#xp_body').addEventListener('change', () => { clearTimeout(t); t = setTimeout(xpRefresh, 30); });
}
function xpRefresh() {
  const pages = expand(), n = pages.length;
  const s = state.settings, [W, H] = paperWH();
  const eff = effectiveExportMode();
  const plan = impositionPlan(n);
  const isStand = !!plan.stand, total = plan.sheets.length;
  if (xpCards) xpCards.build();
  if (xpSheetSeg) xpSheetSeg.sync();
  if (xpColorSeg) xpColorSeg.sync();
  $('#xp_modesWrap').hidden = isStand;
  $('#d_sheetRow').hidden = s.exportMode !== 'fit' || isStand;
  xpIdx = clamp(xpIdx - (xpIdx % 2), 0, Math.max(0, total - 1 - ((total - 1) % 2)));

  const view = k => {
    const sh = plan.sheets[k]; if (!sh) return null;
    // uma página só é desenhada uma vez por folha (cópias no bolso reaproveitam o SVG)
    const cache = new Map();
    const slots = sh.slots.map((sl, i) => {
      const key = sl.src + (sl.base ? 'b' : '');
      if (!cache.has(key)) { const pen = SvgPen(W, H, { bg: s.paperBg }); drawSlot(pen, pages, sl, plan); cache.set(key, pen.svg()); }
      return { x: sl.ox, y: sl.oy, w: W * sl.sc, h: H * sl.sc, rot: sl.rot, svg: cache.get(key), num: sl.base || i ? null : sl.src + 1 };
    });
    return EPShell.sheetSVG({ w: plan.sheetW, h: plan.sheetH, slots, marks: sh.marks, foldY: sh.foldY,
      trimBox: sh.trimBox, bleedBox: sh.bleedBox, trimBoxes: sh.trimBoxes, guides: !isStand });
  };
  const a = view(xpIdx), b = view(xpIdx + 1);
  const lbl = k => { const pd = pages[plan.sheets[k].slots[0].src]; return pd.kind === 'cover' ? (plan.duplex ? 'frente' : 'Capa') : pd.kind === 'year' ? (plan.duplex ? 'verso' : pd.count === 12 ? '12 meses' : `${EPDates.MONTHS_PT[spanMonths()[pd.from].m - 1]} a ${EPDates.MONTHS_PT[spanMonths()[pd.from + pd.count - 1].m - 1]}`) : EPDates.MONTHS_PT[pd.m - 1]; };
  const col = plan.sheetW > plan.sheetH * 1.05;
  $('#xp_preview').innerHTML = `<div class="ep-sheet__stage${col ? ' ep-sheet__stage--col' : ''}">` +
    (a ? `<div class="ep-sheet__page">${a}<span class="ep-sheet__cap">Folha ${xpIdx + 1} · ${lbl(xpIdx)}</span></div>` : '') +
    (b ? `<div class="ep-sheet__page">${b}<span class="ep-sheet__cap">Folha ${xpIdx + 2} · ${lbl(xpIdx + 1)}</span></div>` : '') +
    `</div><div class="ep-sheet__nav"><button type="button" class="iconbtn ghost" data-nav="-2" title="Anterior">${iconSVG('chevleft')}</button>` +
    `<span>folhas ${xpIdx + 1}–${Math.min(total, xpIdx + 2)} de ${total}</span>` +
    `<button type="button" class="iconbtn ghost" data-nav="2" title="Próxima">${iconSVG('chevright')}</button></div>`;
  $('#xp_preview').querySelectorAll('[data-nav]').forEach(bt => {
    const d = +bt.dataset.nav;
    bt.disabled = (d < 0 && xpIdx === 0) || (d > 0 && xpIdx + 2 >= total);
    bt.onclick = () => { xpIdx = clamp(xpIdx + d, 0, total - 1); xpRefresh(); };
  });
  const sheetName = eff.mode === 'fit' ? (eff.sheet === 'a3' ? 'A3' : 'A4') : `${W.toFixed(0)}×${H.toFixed(0)} mm`;
  const sidesTxt = plan.duplex ? `imprimir <b>frente e verso</b> (borda longa) · ${plan.copies} cartões por folha` : 'imprimir só a <b>frente</b>';
  $('#xp_summary').innerHTML = `<span class="big">${plan.duplex ? Math.ceil(total / 2) : total}</span><span class="txt"><b>${(plan.duplex ? Math.ceil(total / 2) : total) === 1 ? 'folha' : 'folhas'} ${esc(sheetName)}${isStand ? ' (face + base)' : ''}</b> · ${sidesTxt}</span>`;
  $('#xp_sub').textContent = `${sizeShort(s.size)} · ${spanLabel()} · ${n} ${n === 1 ? 'página' : 'páginas'}`;

  // ---- verificação ----
  const chk = [];
  chk.push({ level: 'ok', text: `${n} ${n === 1 ? 'página' : 'páginas'} de <b>${W.toFixed(0)}×${H.toFixed(0)} mm</b>, feriados ${s.uf ? 'nacionais e de ' + s.uf : s.holNacional ? 'nacionais' : 'desligados'} marcados, fontes incorporadas.` });
  if (s.pdfColor === 'cmyk') {
    chk.push({ level: 'ok', text: 'Fotos e cores convertidas para <b>CMYK (FOGRA39)</b>, caixas de corte e sangria: <b>PDF/X-4</b>.' });
    if (eff.mode === 'real' && !isStand && !(s.bleedMm >= 3) && s.style !== 'sografe')
      chk.push({ level: 'warn', text: 'Para gráfica, use <b>3 mm de sangria</b>: fotos até a borda ficam sem filete branco no refile.',
        action: { label: 'Usar 3 mm', fn: () => { state.settings.bleedMm = 3; state.settings = migrate(state).settings; syncDocControls(); save(); xpRefresh(); } } });
  }
  const usesPhoto = s.style !== 'sografe';
  if (usesPhoto) {
    const missing = state.months.map((mo, i) => mo.photo ? null : EPDates.MONTHS_PT[i]).filter(Boolean);
    if (missing.length === 12) chk.push({ level: 'warn', text: 'Nenhum mês tem foto: sai um bloco de cor com o número do mês no lugar.', action: { label: 'Adicionar fotos', fn: () => { $('#exportDlg').close(); $('#file_batch').click(); } } });
    else if (missing.length) chk.push({ level: 'warn', text: `<b>${missing.length} ${missing.length === 1 ? 'mês sem foto' : 'meses sem foto'}</b> (${esc(missing.slice(0, 4).join(', '))}${missing.length > 4 ? '…' : ''}): sai o bloco de cor no lugar.`, action: { label: 'Adicionar', fn: () => { $('#exportDlg').close(); $('#file_batch').click(); } } });
    else chk.push({ level: 'ok', text: 'Todos os 12 meses com foto.' });
    const L = monthLayout(s.style, { x: 0, y: 0, w: W, h: H });
    const box = L.photo || L.photoThumb || L.photoFull;
    const low = [];
    state.months.forEach((mo, i) => { if (!mo.photo || !box) return; const d = photoDpi(mo, box.w, box.h); if (d != null && d < 200) low.push({ i, d }); });
    const soft = [];
    state.months.forEach((mo, i) => { if (!mo.photo || !box) return; const d = photoDpi(mo, box.w, box.h); if (d != null && d >= 200 && d < 300) soft.push({ i, d }); });
    if (soft.length) chk.push({ level: 'info', text: `${soft.length === 1 ? 'Uma foto' : soft.length + ' fotos'} entre 200 e 300 dpi (${esc(soft.map(x => EPDates.MONTHS_PT[x.i]).slice(0, 3).join(', '))}): boa em casa; para gráfica o ideal é 300 dpi.` });
    if (low.length) chk.push({ level: 'bad', text: `Resolução baixa em <b>${low.map(x => EPDates.MONTHS_PT[x.i]).slice(0, 3).join(', ')}</b> (${low[0].d} dpi): a foto pode sair borrada. Use uma imagem maior ou diminua o zoom.`,
      action: { label: 'Ver', fn: () => { $('#exportDlg').close(); gotoPage(pages.findIndex(p => p.kind === 'month' && p.m === low[0].i + 1)); } } });
  }
  if (s.showCover && s.coverPhoto) { const cd = photoDpi({ photo: s.coverPhoto, photoSrc: s.coverPhotoSrc, photoEdit: s.coverPhotoEdit }, W, H); if (cd != null && cd < 150) chk.push({ level: 'bad', text: `Foto da capa com resolução baixa (${cd} dpi): pode sair borrada.`, action: { label: 'Ver', fn: () => { $('#exportDlg').close(); gotoPage(0); } } }); }
  if (s.showCover && !s.coverPhoto) chk.push({ level: 'info', text: 'Capa sem foto: sai com o ano em destaque e os 12 meses em miniatura.' });
  const bt = BINDING_TYPES[s.binding];
  if (bt && bt.edge) chk.push({ level: 'info', text: `Margem de <b>${bindMargin(bt).toFixed(0)} mm</b> reservada ${bt.edge === 'top' ? 'no topo' : 'na lateral'} para ${esc(bt.label.split(' (')[0].toLowerCase())}.` });
  if (isStand) chk.push({ level: 'info', text: 'Cavalete: cada folha traz a face e o verso (girado). Dobre na linha tracejada em tenda — as duas faces ficam de pé.' });
  const sc = plan.sheets[0] && plan.sheets[0].slots[0] ? plan.sheets[0].slots[0].sc : 1;
  if (sc < 0.985) chk.push({ level: 'warn', text: `As páginas saem reduzidas a <b>${Math.round(sc * 100)}%</b> para caber na folha.`, action: { label: 'Usar A3', fn: () => { $('#d_sheet').value = 'a3'; $('#d_sheet').dispatchEvent(new Event('change', { bubbles: true })); } } });
  EPShell.checklist($('#xp_check'), chk);
}
function openExportDlg() {
  closeHistoryPop();
  xpSetup(); xpIdx = 0;
  if (isMobile()) { if (typeof mOpenTab === 'function') mOpenTab('exportar'); xpRefresh(); return; }
  syncDocControls(); xpRefresh();
  const d = $('#exportDlg'); if (!d.open) d.showModal();
  setStep(2);
}
$('#exportDlg').addEventListener('close', () => setStep(1));
$('#b_exportCfg').onclick = e => { e.stopPropagation(); openExportDlg(); };
$('#m_print').onclick = () => { $('#menu').hidden = true; menuScrim(false); openExportDlg(); };
{
  const _sync = syncDocControls;
  syncDocControls = function () {
    _sync();
    syncStyleCards();
    const d = $('#exportDlg');
    if ((d && d.open) || (isMobile() && typeof mTab !== 'undefined' && mTab === 'exportar')) { clearTimeout(syncDocControls._t); syncDocControls._t = setTimeout(xpRefresh, 20); }
  };
}
addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
    const d = $('#exportDlg'); if (d && d.open) return;
    e.preventDefault(); e.stopImmediatePropagation(); openExportDlg();
  }
  if (e.key === 'Escape' && document.querySelector('dialog[open]')) e.stopImmediatePropagation();
}, true);

// status da barra
{
  const _render = render;
  render = function () {
    _render();
    const s = state.settings, n = state.months.filter(m => m.photo).length;
    const st = $('#stat'); if (st) st.textContent = `${sizeShort(s.size)} · ${s.year}` + (s.style !== 'sografe' ? ` · ${n}/12 fotos` : '');
  };
}

syncStyleCards();
injectIcons();
render();
setStep(document.body.classList.contains('onboarding') ? 0 : 1);

// folha de calibração (núcleo): régua de 100 mm, margem mínima, cinzas e cores
{ const bc = document.getElementById('b_calib'); if (bc) bc.onclick = async () => {
  busy('Gerando folha de calibração…');
  try { const bytes = await EPPen.calibrationPdf({ color: state.settings.pdfColor }); downloadBlob(new Blob([bytes], { type: 'application/pdf' }), 'folha-de-calibracao.pdf'); }
  catch (e) { console.error(e); toast('Erro ao gerar a folha de calibração.'); }
  unbusy();
}; }
