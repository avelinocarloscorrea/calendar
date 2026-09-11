/*
 * Esmeralda Paper — packages/core/imgedit.js
 *
 * Editor de foto reaproveitável (arrastar para posicionar, zoom, rotação,
 * espelhar, filtros) — a mesma ideia que o Polaroide Studio já tinha, só que
 * genérica: qualquer ferramenta que precise encaixar uma foto numa caixa
 * (capa, fundo, uma página de mês…) usa o MESMO editor.
 *
 * Só roda no navegador (constrói DOM, desenha em <canvas>) — como pen.js,
 * não é testável em Node e não entra em `npm test`. Carregado via
 * <script src="vendor/core/imgedit.js"> (build.sh copia de packages/core/),
 * define window.EPImgEdit.
 *
 * Diferença importante para quem for reaproveitar: o Polaroide Studio
 * exporta em RASTER (desenha cada folha inteira num <canvas> e vira JPEG no
 * PDF), então ele aplica o ajuste da foto na hora de exportar. Planner
 * Studio e Calendar Studio exportam em PDF VETORIAL (packages não… cada app
 * tem seu próprio pen.js/buildPDF) — lá, `pen.image()` só desenha x,y,w,h,
 * sem transformação nenhuma. Por isso este módulo "assa" (bake) o ajuste
 * numa imagem final via <canvas> no momento de Aplicar, e devolve só o
 * resultado pronto — o app consumidor trata isso como uma foto comum.
 */
(function (root) {
  "use strict";

  function clamp(v, a, b) { const n = +v; return isFinite(n) ? Math.min(b, Math.max(a, n)) : a; }

  function defaultEdit() {
    return { zoom: 1, ox: 0, oy: 0, rot: 0, flipH: false,
      filter: { brightness: 1, contrast: 1, saturate: 1, sepia: 0, grayscale: 0 } };
  }
  function normEdit(raw) {
    const r = (raw && typeof raw === 'object') ? raw : {};
    const f = (r.filter && typeof r.filter === 'object') ? r.filter : {};
    return {
      zoom: clamp(r.zoom, 0.4, 4),
      ox: clamp(r.ox, -90, 90),
      oy: clamp(r.oy, -90, 90),
      rot: clamp(r.rot, -45, 45),
      flipH: !!r.flipH,
      filter: {
        brightness: clamp(f.brightness, 0.4, 1.8),
        contrast: clamp(f.contrast, 0.4, 1.8),
        saturate: clamp(f.saturate, 0, 2.2),
        sepia: clamp(f.sepia, 0, 1),
        grayscale: clamp(f.grayscale, 0, 1),
      },
    };
  }
  function cssFilter(edit) {
    const f = edit.filter;
    return `brightness(${f.brightness}) contrast(${f.contrast}) saturate(${f.saturate}) sepia(${f.sepia}) grayscale(${f.grayscale})`;
  }
  // transform CSS da prévia ao vivo — a janela (.imgedit-win) tem
  // position:relative + overflow:hidden; a <img> fica centralizada nela
  // (top:50%;left:50%) e este transform faz o resto.
  function imgTransform(edit) {
    return `translate(-50%,-50%) translate(${edit.ox}%,${edit.oy}%) rotate(${edit.rot}deg) scale(${edit.flipH ? -edit.zoom : edit.zoom},${edit.zoom})`;
  }
  // assa o recorte final num canvas outW×outH (px) — mesma matemática da
  // prévia (a janela sempre é "coberta" pela foto; zoom multiplica esse
  // preenchimento natural). Devolve o <canvas> (chamador decide o formato).
  function bake(imgEl, edit, outW, outH) {
    const e = normEdit(edit);
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(outW));
    cv.height = Math.max(1, Math.round(outH));
    const ctx = cv.getContext('2d');
    const iw = imgEl.naturalWidth || imgEl.width, ih = imgEl.naturalHeight || imgEl.height;
    const f = Math.max(cv.width / iw, cv.height / ih) * e.zoom;
    const dw = iw * f, dh = ih * f;
    const icx = cv.width / 2 + (e.ox / 100) * cv.width;
    const icy = cv.height / 2 + (e.oy / 100) * cv.height;
    ctx.save();
    ctx.translate(icx, icy);
    if (e.rot) ctx.rotate(e.rot * Math.PI / 180);
    if (e.flipH) ctx.scale(-1, 1);
    try { ctx.filter = cssFilter(e); } catch (err) {}
    ctx.drawImage(imgEl, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    return cv;
  }
  function bakeDataURL(imgEl, edit, outW, outH, mime, quality) {
    const cv = bake(imgEl, edit, outW, outH);
    return cv.toDataURL(mime || 'image/jpeg', quality == null ? 0.88 : quality);
  }
  function loadImage(src) {
    return new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('Não consegui abrir a imagem.'));
      im.src = src;
    });
  }
  function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m])); }

  /* ===================== overlay do editor ===================== */
  let _active = null; // { close() } — só 1 por vez
  function closeActive() { if (_active) { _active.close(); _active = null; } }

  // opts: { src, aspect (w/h), edit, title, hint, outMax, applyLabel, onApply(res), onCancel() }
  // res do onApply: { dataURL, edit }
  function open(opts) {
    closeActive();
    const o = Object.assign({ aspect: 1, title: 'Editar foto', outMax: 1800, applyLabel: 'Aplicar' }, opts || {});
    let edit = normEdit(o.edit || defaultEdit());
    let natEl = null, ready = false;

    const scrim = document.createElement('div'); scrim.className = 'imgedit-scrim';
    const modal = document.createElement('div'); modal.className = 'imgedit-modal';
    modal.innerHTML =
      `<div class="imgedit-head"><span>${escHtml(o.title)}</span><button type="button" class="iconbtn ghost" data-x title="Fechar">✕</button></div>` +
      `<div class="imgedit-stage"><div class="imgedit-win"><img class="imgedit-img" alt=""></div>` +
      `<p class="imgedit-hint">${escHtml(o.hint || 'Arraste para posicionar · roda ou pinça para zoom')}</p></div>` +
      `<div class="imgedit-tools scrl">` +
        `<div class="imgedit-btnrow">` +
          `<button type="button" data-flip>Espelhar</button>` +
          `<button type="button" data-reset>Centralizar</button>` +
        `</div>` +
        `<label>Zoom <span class="v" data-zoomv></span><input type="range" data-zoom min="0.4" max="4" step="0.01"></label>` +
        `<label>Rotação <span class="v" data-rotv></span><input type="range" data-rot min="-45" max="45" step="0.5"></label>` +
        `<label>Brilho <span class="v" data-brv></span><input type="range" data-br min="0.4" max="1.8" step="0.01"></label>` +
        `<label>Contraste <span class="v" data-cov></span><input type="range" data-co min="0.4" max="1.8" step="0.01"></label>` +
        `<label>Saturação <span class="v" data-sav></span><input type="range" data-sa min="0" max="2.2" step="0.01"></label>` +
        `<label>Sépia <span class="v" data-sev></span><input type="range" data-se min="0" max="1" step="0.01"></label>` +
        `<label>Preto e branco <span class="v" data-grv></span><input type="range" data-gr min="0" max="1" step="0.01"></label>` +
      `</div>` +
      `<div class="imgedit-foot">` +
        `<button type="button" data-cancel>Cancelar</button>` +
        `<button type="button" class="primary" data-apply>${escHtml(o.applyLabel)}</button>` +
      `</div>`;
    document.body.append(scrim, modal);
    if (typeof injectIcons === 'function') { try { injectIcons(modal); } catch (e) {} }

    const win = modal.querySelector('.imgedit-win');
    const img = modal.querySelector('.imgedit-img');
    const aspectN = Math.max(0.05, +o.aspect || 1);
    // tamanho em px calculado na mão (não só CSS aspect-ratio): pra um
    // recorte retrato (ex.: a capa inteira de um A4) não tomar a modal
    // inteira e sobrar espaço pros controles embaixo.
    (function sizeWin() {
      const avail = Math.min(modal.clientWidth || 440, 440) - 28;
      const maxH = Math.round(innerHeight * 0.40);
      let ww = Math.max(120, avail), hh = ww / aspectN;
      if (hh > maxH) { hh = maxH; ww = hh * aspectN; }
      win.style.width = Math.round(ww) + 'px';
      win.style.height = Math.round(hh) + 'px';
    })();

    const els = {
      zoom: modal.querySelector('[data-zoom]'), zoomv: modal.querySelector('[data-zoomv]'),
      rot: modal.querySelector('[data-rot]'), rotv: modal.querySelector('[data-rotv]'),
      br: modal.querySelector('[data-br]'), brv: modal.querySelector('[data-brv]'),
      co: modal.querySelector('[data-co]'), cov: modal.querySelector('[data-cov]'),
      sa: modal.querySelector('[data-sa]'), sav: modal.querySelector('[data-sav]'),
      se: modal.querySelector('[data-se]'), sev: modal.querySelector('[data-sev]'),
      gr: modal.querySelector('[data-gr]'), grv: modal.querySelector('[data-grv]'),
    };
    function syncUI() {
      els.zoom.value = edit.zoom; els.zoomv.textContent = edit.zoom.toFixed(2) + '×';
      els.rot.value = edit.rot; els.rotv.textContent = edit.rot.toFixed(1) + '°';
      els.br.value = edit.filter.brightness; els.brv.textContent = Math.round(edit.filter.brightness * 100) + '%';
      els.co.value = edit.filter.contrast; els.cov.textContent = Math.round(edit.filter.contrast * 100) + '%';
      els.sa.value = edit.filter.saturate; els.sav.textContent = Math.round(edit.filter.saturate * 100) + '%';
      els.se.value = edit.filter.sepia; els.sev.textContent = Math.round(edit.filter.sepia * 100) + '%';
      els.gr.value = edit.filter.grayscale; els.grv.textContent = Math.round(edit.filter.grayscale * 100) + '%';
    }
    function paint() { img.style.transform = imgTransform(edit); img.style.filter = cssFilter(edit); }
    syncUI(); paint();

    loadImage(o.src).then(im => { natEl = im; ready = true; img.src = o.src; }).catch(() => {
      modal.querySelector('.imgedit-stage').insertAdjacentHTML('beforeend', '<p class="hint">Não consegui carregar a imagem.</p>');
    });

    const rangeBind = (el, cb) => el.addEventListener('input', () => { cb(parseFloat(el.value)); syncUI(); paint(); });
    rangeBind(els.zoom, v => edit.zoom = clamp(v, 0.4, 4));
    rangeBind(els.rot, v => edit.rot = clamp(v, -45, 45));
    rangeBind(els.br, v => edit.filter.brightness = clamp(v, 0.4, 1.8));
    rangeBind(els.co, v => edit.filter.contrast = clamp(v, 0.4, 1.8));
    rangeBind(els.sa, v => edit.filter.saturate = clamp(v, 0, 2.2));
    rangeBind(els.se, v => edit.filter.sepia = clamp(v, 0, 1));
    rangeBind(els.gr, v => edit.filter.grayscale = clamp(v, 0, 1));

    modal.querySelector('[data-flip]').onclick = () => { edit.flipH = !edit.flipH; paint(); };
    modal.querySelector('[data-reset]').onclick = () => { edit = defaultEdit(); syncUI(); paint(); };

    // arrastar pra posicionar
    let drag = null;
    win.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      const rect = win.getBoundingClientRect();
      drag = { sx: e.clientX, sy: e.clientY, sox: edit.ox, soy: edit.oy, rw: rect.width, rh: rect.height };
      win.setPointerCapture(e.pointerId); win.classList.add('drag');
    });
    win.addEventListener('pointermove', e => {
      if (!drag) return;
      edit.ox = clamp(drag.sox + (e.clientX - drag.sx) / drag.rw * 100, -90, 90);
      edit.oy = clamp(drag.soy + (e.clientY - drag.sy) / drag.rh * 100, -90, 90);
      paint();
    });
    const endDrag = e => { if (!drag) return; try { win.releasePointerCapture(e.pointerId); } catch (_) {} win.classList.remove('drag'); drag = null; syncUI(); };
    win.addEventListener('pointerup', endDrag);
    win.addEventListener('pointercancel', endDrag);
    // roda / Ctrl+roda = zoom
    win.addEventListener('wheel', e => {
      e.preventDefault();
      edit.zoom = clamp(edit.zoom * Math.exp(-e.deltaY * 0.0016), 0.4, 4);
      syncUI(); paint();
    }, { passive: false });
    // pinça (2 dedos) = zoom
    let pinch = null;
    const tdist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    win.addEventListener('touchstart', e => { if (e.touches.length === 2) pinch = { d: tdist(e.touches), z: edit.zoom }; }, { passive: true });
    win.addEventListener('touchmove', e => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const d = tdist(e.touches);
      if (pinch.d > 0 && d > 0) edit.zoom = clamp(pinch.z * (d / pinch.d), 0.4, 4);
      syncUI(); paint();
    }, { passive: false });
    const endPinch = e => { if (pinch && (!e.touches || e.touches.length < 2)) pinch = null; };
    win.addEventListener('touchend', endPinch); win.addEventListener('touchcancel', endPinch);

    function close() {
      scrim.remove(); modal.remove();
      document.removeEventListener('keydown', onKey, true);
    }
    function onKey(e) { if (e.key === 'Escape') { close(); if (o.onCancel) o.onCancel(); } }
    document.addEventListener('keydown', onKey, true);
    scrim.addEventListener('pointerdown', () => { close(); if (o.onCancel) o.onCancel(); });
    modal.querySelector('[data-x]').onclick = modal.querySelector('[data-cancel]').onclick = () => { close(); if (o.onCancel) o.onCancel(); };
    modal.querySelector('[data-apply]').onclick = () => {
      if (!ready || !natEl) return;
      const aspect = Math.max(0.05, +o.aspect || 1);
      const outMax = clamp(o.outMax, 400, 3000);
      const outW = aspect >= 1 ? outMax : Math.round(outMax * aspect);
      const outH = aspect >= 1 ? Math.round(outMax / aspect) : outMax;
      let dataURL;
      try { dataURL = bakeDataURL(natEl, edit, outW, outH); }
      catch (e) { console.error(e); return; }
      close();
      if (o.onApply) o.onApply({ dataURL, edit: normEdit(edit) });
    };

    _active = { close: () => { close(); } };
    return _active;
  }

  const api = { open, close: closeActive, bake, bakeDataURL, normEdit, defaultEdit, cssFilter, imgTransform, loadImage };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EPImgEdit = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this));
