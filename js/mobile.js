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
  const exp = $('#d_exportWrap'), mxMount = $('#mx_settings'), privNote = $('#d_privadoNote');
  if (!app || !stg || !wrap) return;
  if (isMobile()) {
    if (stg.parentElement !== wrap) wrap.appendChild(stg);
    if (left && left.parentElement !== shL) shL.appendChild(left);
    if (right && right.parentElement !== shR) shR.appendChild(right);
    if (exp && mxMount && exp.parentElement !== mxMount) { mxMount.appendChild(exp); exp.open = true; }
    document.body.classList.add('is-mobile');
  } else if (stg.parentElement !== app) {
    if (exp && left && privNote && exp.parentElement !== left) left.insertBefore(exp, privNote);
    if (left) app.appendChild(left);
    app.appendChild(stg);
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

function mSetup() {
  mPlace();
  mCollapseDocPanels();
  $$('#mtabs button').forEach(b => b.onclick = () => mOpenTab(b.dataset.tab));
  $('#mu_undo') && ($('#mu_undo').onclick = undo);
  $('#mu_redo') && ($('#mu_redo').onclick = redo);
  $('#mx_pdf') && ($('#mx_pdf').onclick = exportPDF);
  $('#mx_png') && ($('#mx_png').onclick = exportPNG);
  $('#mx_print') && ($('#mx_print').onclick = printDoc);
  $('#mx_save') && ($('#mx_save').onclick = exportProject);
  $('#mx_open') && ($('#mx_open').onclick = () => $('#file_open').click());
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
  if (tab === 'paginas' && !userZoomed) requestAnimationFrame(fit);
  const sh = $$('.msheet').find(s => s.dataset.tab === tab); if (sh) sh.scrollTop = 0;
}

function mSync() {
  const mp = $('#mpg');
  if (mp) { const n = pageCount(); mp.textContent = n > 1 ? `Pág. ${currentPage + 1}/${n}` : ''; }
}
function mSyncRight() {/* mesmo DOM do desktop; nada a fazer */ }
