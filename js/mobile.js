/* Calendar Studio — js/mobile.js
   Casca de celular (≤ 820 px). O MESMO DOM do desktop é reaproveitado: o
   palco e os painéis esquerdo/direito são movidos entre a casca de desktop
   (#app) e a de celular (#mroot) conforme a largura.
   (parte de app; carregado em ordem por index.html) */
"use strict";

let mTab = 'paginas';

function mPlace() {
  const app = $('#app'), stg = $('#stage'), left = $('#left'), right = $('#right');
  const wrap = $('#mstageWrap'), shL = $('#msheet_doc'), shR = $('#msheet_pag');
  const exp = $('#xp_body'), mxMount = $('#mx_settings'), dlgHost = $('#xp_bodyHost');
  const prev = $('#xp_prevHost'), dlgMain = $('#exportDlg .xdlg-main'), cbar = $('#canvasbar');
  if (!app || !stg || !wrap) return;
  if (isMobile()) {
    if (stg.parentElement !== wrap) wrap.appendChild(stg);
    if (left && left.parentElement !== shL) shL.appendChild(left);
    if (right && right.parentElement !== shR) shR.appendChild(right);
    if (prev && mxMount && prev.parentElement !== mxMount) mxMount.appendChild(prev);
    if (exp && mxMount && exp.parentElement !== mxMount) mxMount.appendChild(exp);
    document.body.classList.add('is-mobile');
  } else if (stg.parentElement !== app) {
    if (exp && dlgHost && exp.parentElement !== dlgHost) dlgHost.appendChild(exp);
    if (prev && dlgMain && prev.parentElement !== dlgMain) dlgMain.insertBefore(prev, dlgMain.firstChild);
    if (left) app.appendChild(left);
    app.appendChild(stg);
    if (cbar) app.appendChild(cbar);
    if (right) app.appendChild(right);
    document.body.classList.remove('is-mobile');
  }
}

let _mCollapsedOnce = false;
function mCollapseDocPanels() {
  if (_mCollapsedOnce || !isMobile()) return;
  _mCollapsedOnce = true;
  const dets = $$('#left > details');
  dets.forEach((d, i) => { d.open = i === 0; });
}

// Arrastar pra baixo fecha — portado do Polaroide Studio (js/m-core.js).
// `grab` é a barrinha (só ela recebe o gesto, o resto da folha rola normal);
// `sheet` é o elemento que desliza; `onClose` roda quando o arraste passa do
// limiar de distância OU de velocidade.
function mDragClose(grab, sheet, onClose) {
  if (!grab || !sheet) return;
  let y0 = 0, dy = 0, t0 = 0, on = false;
  grab.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    y0 = e.touches[0].clientY; dy = 0; t0 = Date.now(); on = true;
    sheet.style.transition = 'none';
  }, { passive: true });
  grab.addEventListener('touchmove', e => {
    if (!on) return;
    dy = e.touches[0].clientY - y0; if (dy < 0) dy = 0;
    sheet.style.transform = 'translateY(' + dy + 'px)';
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  grab.addEventListener('touchend', () => {
    if (!on) return;
    on = false;
    const vy = dy / Math.max(1, Date.now() - t0);
    sheet.style.transition = ''; sheet.style.transform = '';
    if (dy > 120 || (dy > 44 && vy > 0.5)) onClose();
  }, { passive: true });
  // gesto interrompido (notificação, troca de app, edge-swipe do sistema) —
  // sem isso a folha ficava com transform/transition presos a meio caminho
  // até o próximo arraste, já que #menu é reaproveitado (não recriado).
  grab.addEventListener('touchcancel', () => {
    if (!on) return;
    on = false;
    sheet.style.transition = ''; sheet.style.transform = '';
  }, { passive: true });
}
function mEnsureGrab(sheet) {
  let g = sheet.querySelector('.m-grab');
  if (!g) { g = document.createElement('div'); g.className = 'm-grab'; g.appendChild(document.createElement('i')); sheet.insertBefore(g, sheet.firstChild); }
  return g;
}

function mSetup() {
  mPlace();
  mCollapseDocPanels();
  { const men = $('#menu'); if (men) mDragClose(mEnsureGrab(men), men, () => { men.hidden = true; menuScrim(false); }); }
  $$('#mtabs button').forEach(b => b.onclick = () => mOpenTab(b.dataset.tab));
  $('#mu_undo') && ($('#mu_undo').onclick = undo);
  $('#mu_redo') && ($('#mu_redo').onclick = redo);
  $('#mx_pdf') && ($('#mx_pdf').onclick = exportPDF);
  $('#mx_png') && ($('#mx_png').onclick = exportPNG);
  $('#mx_print') && ($('#mx_print').onclick = printDoc);
  $('#mx_save') && ($('#mx_save').onclick = exportProject);
  $('#mx_open') && ($('#mx_open').onclick = () => $('#file_open').click());
  $('#msel_adjust') && ($('#msel_adjust').onclick = () => { _selBarExpanded = !_selBarExpanded; mSyncRight(curPage()); });
  mOpenTab('paginas');
  let rt, wasMob = isMobile();
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      mPlace();
      const nowMob = isMobile();
      if (nowMob !== wasMob) { wasMob = nowMob; if (typeof renderMonthList === 'function') renderMonthList(); }
      if (!userZoomed) fit();
    }, 160);
  });
}

function mOpenTab(tab) {
  if (!isMobile()) return;
  { const mn = $('#menu'); if (mn) mn.hidden = true; }
  if (typeof menuScrim === 'function') menuScrim(false);
  mTab = tab;
  $$('#mtabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  $$('.msheet').forEach(s => s.hidden = (s.dataset.tab !== tab));
  const w = $('#mstageWrap'); if (w) w.hidden = (tab !== 'paginas');
  if (tab === 'pagina' && typeof fillRight === 'function') fillRight();
  if (tab === 'paginas' && !userZoomed) requestAnimationFrame(fit);
  if (tab === 'exportar' && typeof xpRefresh === 'function') { if (typeof xpSetup === 'function') xpSetup(); requestAnimationFrame(xpRefresh); }
  const sh = $$('.msheet').find(s => s.dataset.tab === tab); if (sh) sh.scrollTop = 0;
}

function mSync() {
  const mp = $('#mpg');
  if (mp) { const n = pageCount(); mp.textContent = n > 1 ? `Pág. ${currentPage + 1}/${n}` : ''; }
}

/* ================= barra de seleção curta (aba "Página", só mobile) =================
   Mesmo padrão portado do Polaroide Studio pro Planner: a página atual (capa
   ou mês) some atrás de uma barrinha curta (nome + "Ajustar") em vez de abrir
   direto o painel inteiro (título/foto/legenda). Trocar de página volta a
   nascer recolhida. */
let _selBarExpanded = true, _selBarLastKey = null;
function mSyncRight(pd) {
  pd = pd || (typeof curPage === 'function' ? curPage() : null);
  const bar = $('#msel_bar'), sheet = $('#msheet_pag');
  if (!bar || !sheet) return;
  if (!isMobile() || !pd) { bar.hidden = true; sheet.classList.remove('collapsed'); _selBarLastKey = null; return; }
  const key = pd.kind + ':' + (pd.m || '');
  _selBarLastKey = key;
  bar.hidden = false;
  $('#msel_name').textContent = pd.kind === 'cover' ? 'Capa' : EPDates.MONTHS_PT[pd.m - 1];
  $('#msel_adjust').textContent = _selBarExpanded ? 'Recolher' : 'Ajustar';
  sheet.classList.toggle('collapsed', !_selBarExpanded);
}
