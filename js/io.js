/* Calendar Studio — js/io.js
   Exportar PDF vetorial (multipágina), PNG da página atual, impressão pronta
   (mesma imposição do PDF) e salvar/abrir projeto .json. Tudo no navegador —
   nada é enviado. (parte de app; carregado em ordem por index.html) */
"use strict";

const OUT_SHEETS = { a4: [210, 297], a3: [297, 420] };
function outSheet(id) { return OUT_SHEETS[id] || OUT_SHEETS.a4; }

// "real": 1 folha = 1 página, tamanho exato do miolo — para a gráfica.
// "fit": página centralizada numa folha comum + marcas de corte nos 4 cantos.
function impositionPlan(nPages) {
  const s = state.settings, [W, H] = paperWH();
  const mode = s.exportMode === 'fit' ? 'fit' : 'real';
  // mesa cavalete: a folha sai com o DOBRO da altura — face em cima, painel de
  // apoio embaixo (drawStandBase, calendar.js), com uma faixa de dobra entre
  // os dois. migrate() já garante que isso só acontece com exportMode 'real'.
  const stand = !!(SIZES[s.size] && SIZES[s.size].stand);
  if (mode === 'real') {
    const gap = stand ? 6 : 0;
    const sheetH = stand ? (H * 2 + gap) : H;
    const sheets = [];
    for (let i = 0; i < nPages; i++) sheets.push({ slots: [{ src: i, ox: 0, oy: 0, sc: 1 }], trims: [] });
    return { mode, sheetW: W, sheetH, sheets, stand, gap, faceH: H };
  }
  const B = outSheet(s.sheet);
  let sw = B[0], sh = B[1];
  if (W > sw || H > sh) { sw = B[1]; sh = B[0]; }
  const sc = Math.min(1, (sw - 6) / W, (sh - 6) / H);
  const pw = W * sc, ph = H * sc, ox = (sw - pw) / 2, oy = (sh - ph) / 2;
  const sheets = [];
  for (let i = 0; i < nPages; i++) sheets.push({ slots: [{ src: i, ox, oy, sc }], trims: [[ox, oy, pw, ph]] });
  return { mode, sheetW: sw, sheetH: sh, sheets };
}
function sheetFileTag(s) {
  if (SIZES[s.size] && SIZES[s.size].stand) return '-cavalete';
  return s.exportMode === 'fit' ? '-' + (s.sheet === 'a3' ? 'A3' : 'A4') + '-corte' : '';
}
function modeLabel(s) {
  if (SIZES[s.size] && SIZES[s.size].stand) return 'mesa cavalete — dobrar ao meio';
  return s.exportMode === 'fit' ? '1 página por folha + marcas de corte' : 'tamanho real';
}

function drawSheetMarks(pen, sheet) {
  const L = 5, g = 2.2, o = { w: 0.15, color: '#000' };
  (sheet.trims || []).forEach(([x, y, w, h]) => {
    [[x, y, -1, -1], [x + w, y, 1, -1], [x, y + h, -1, 1], [x + w, y + h, 1, 1]].forEach(([px, py, dx, dy]) => {
      pen.line(px + dx * g, py, px + dx * (g + L), py, o);
      pen.line(px, py + dy * g, px, py + dy * (g + L), o);
    });
  });
}
function planMarksSVG(sheet) {
  const L = 5, g = 2.2, w = 0.15;
  const seg = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="${w}"/>`;
  let p = '';
  (sheet.trims || []).forEach(([x, y, ww, hh]) => {
    [[x, y, -1, -1], [x + ww, y, 1, -1], [x, y + hh, -1, 1], [x + ww, y + hh, 1, 1]].forEach(([px, py, dx, dy]) => {
      p += seg(px + dx * g, py, px + dx * (g + L), py) + seg(px, py + dy * g, px, py + dy * (g + L));
    });
  });
  return p ? `<svg class="pmarks" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sheet.__sw} ${sheet.__sh}">${p}</svg>` : '';
}

function docName() { return (state.settings.title || 'Calendario').replace(/[^\wÀ-ÿ .-]/g, '').trim().slice(0, 60); }

async function exportPDF() {
  const pages = expand();
  if (typeof resetPdfImages === 'function') resetPdfImages();
  const s = state.settings, [W, H] = paperWH();
  const plan = impositionPlan(pages.length);
  busy('Gerando PDF — ' + plan.sheets.length + ' folha(s)…');
  await new Promise(r => setTimeout(r, 20));
  try {
    const f = v => (+v).toFixed(3);
    const out = [];
    for (let si = 0; si < plan.sheets.length; si++) {
      const sheet = plan.sheets[si];
      const bg = PdfPen(plan.sheetW, plan.sheetH, 0, 0);
      bg.rect(0, 0, plan.sheetW, plan.sheetH, { fill: '#ffffff' });
      let content = bg.stream();
      for (const slot of sheet.slots) {
        const sp = PdfPen(W, H, 0, 0);
        drawPageInto(sp, pages[slot.src], slot.src, { screen: false });
        const tx = slot.ox * PT, ty = (plan.sheetH - slot.oy - H * slot.sc) * PT;
        content += '\nq ' + f(slot.sc) + ' 0 0 ' + f(slot.sc) + ' ' + f(tx) + ' ' + f(ty) + ' cm\n' + sp.stream() + '\nQ';
        if (plan.stand) {
          const base = PdfPen(W, H, 0, 0);
          drawStandBase(base, { x: 0, y: 0, w: W, h: H }, s);
          const ty2 = (plan.sheetH - (slot.oy + H + plan.gap) - H * slot.sc) * PT;
          content += '\nq ' + f(slot.sc) + ' 0 0 ' + f(slot.sc) + ' ' + f(tx) + ' ' + f(ty2) + ' cm\n' + base.stream() + '\nQ';
          const fold = PdfPen(plan.sheetW, plan.sheetH, 0, 0);
          fold.line(0, H + plan.gap / 2, plan.sheetW, H + plan.gap / 2, { w: 0.25, color: '#888888', dash: [2, 2] });
          content += '\n' + fold.stream();
        }
      }
      const deco = PdfPen(plan.sheetW, plan.sheetH, 0, 0);
      drawSheetMarks(deco, sheet);
      content += '\n' + deco.stream();
      out.push({ stream: content, wPt: plan.sheetW * PT, hPt: plan.sheetH * PT });
      if (si % 5 === 0) { busy('Folha ' + (si + 1) + ' / ' + plan.sheets.length + '…'); await new Promise(r => setTimeout(r, 0)); }
    }
    busy('Montando o arquivo…'); await new Promise(r => setTimeout(r, 0));
    const bytes = await buildPDF(out);
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), (docName() || 'calendario') + sheetFileTag(s) + '.pdf');
    toast('PDF: ' + plan.sheets.length + ' folha(s) · ' + (bytes.length / 1024).toFixed(0) + ' KB · ' + modeLabel(s));
  } catch (e) { console.error(e); toast('Erro ao gerar o PDF.'); }
  unbusy();
}

async function exportPNG() {
  const pages = expand();
  const i = clamp(currentPage, 0, pages.length - 1);
  busy('Gerando PNG da página ' + (i + 1) + '…');
  try {
    const [W, H] = paperWH();
    const dpi = clamp(Math.round(num(state.settings.exportDPI, 300)), 150, 600);
    try { await document.fonts.ready; } catch (e) {}
    let svg = buildSVG(i, pages[i]);
    if (typeof embeddedFontStyle === 'function') svg = svg.replace(/(<svg[^>]*>)/, '$1' + embeddedFontStyle());
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
    const cv = document.createElement('canvas');
    cv.width = Math.round(W / 25.4 * dpi); cv.height = Math.round(H / 25.4 * dpi);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    downloadBlob(blob, (docName() || 'calendario') + '-pag-' + (i + 1) + '.png');
  } catch (e) { console.error(e); toast('Erro ao gerar o PNG.'); }
  unbusy();
}

/* injeta regras de impressão sem <style> inline (a CSP proíbe) via CSSOM
   da própria folha já carregada, ou constructable stylesheet como reserva. */
function installPrintRules(ruleList) {
  let sheet = null, constructed = null;
  for (const ss of document.styleSheets) {
    try { if (ss.href && /(print|studio|base)\.css(\?|$)/.test(ss.href) && ss.cssRules) { sheet = ss; break; } } catch (e) {}
  }
  if (!sheet) {
    try {
      if ('adoptedStyleSheets' in document && typeof CSSStyleSheet === 'function') {
        constructed = new CSSStyleSheet();
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, constructed];
        sheet = constructed;
      }
    } catch (e) { constructed = null; sheet = null; }
  }
  if (!sheet) return null;
  const added = [];
  ruleList.forEach(r => { try { added.push(sheet.insertRule(r, sheet.cssRules.length)); } catch (e) { console.warn('print rule falhou', e); } });
  return () => {
    if (constructed) { try { document.adoptedStyleSheets = document.adoptedStyleSheets.filter(x => x !== constructed); } catch (e) {} return; }
    added.sort((a, b) => b - a).forEach(i => { try { sheet.deleteRule(i); } catch (e) {} });
  };
}
function n2(v) { return Math.round(v * 100) / 100; }

async function printDoc() {
  const pages = expand();
  const s = state.settings, [W, H] = paperWH();
  const plan = impositionPlan(pages.length);
  busy('Preparando impressão — ' + plan.sheets.length + ' folha(s)…');
  await new Promise(r => setTimeout(r, 20));
  try {
    const old = document.getElementById('printRoot'); if (old) old.remove();
    if (window.__printCleanup) { try { window.__printCleanup(); } catch (e) {} window.__printCleanup = null; }
    const SW = n2(plan.sheetW), SH = n2(plan.sheetH);
    const removeRules = installPrintRules([
      '@page{size:' + SW + 'mm ' + SH + 'mm;margin:0}',
      '@media print{' +
        'html,body{margin:0!important;padding:0!important;background:#fff!important;height:auto!important;min-height:0!important;overflow:visible!important}' +
        'body>*{display:none!important}body>#printRoot{display:block!important}' +
        '#printRoot .psheet{position:relative;width:' + SW + 'mm;height:' + n2(plan.sheetH - 0.2) + 'mm;overflow:hidden;background:#fff;page-break-after:always;break-after:page;page-break-inside:avoid;break-inside:avoid}' +
        '#printRoot .psheet:last-child{page-break-after:auto;break-after:auto}' +
        '#printRoot .pslot{position:absolute}#printRoot .pslot>svg{display:block;width:100%;height:100%}' +
        '#printRoot .pmarks{position:absolute;left:0;top:0;width:100%;height:100%}' +
      '}'
    ]);
    if (!removeRules) { toast('Seu navegador bloqueou o preparo da impressão. Use o botão PDF.'); unbusy(); return; }
    const root = document.createElement('div'); root.id = 'printRoot';
    for (let si = 0; si < plan.sheets.length; si++) {
      const sheet = plan.sheets[si];
      const psheet = document.createElement('div'); psheet.className = 'psheet';
      for (const slot of sheet.slots) {
        const pen = SvgPen(W, H, { bg: '#ffffff' });
        drawPageInto(pen, pages[slot.src], slot.src, { screen: false });
        const sl = document.createElement('div'); sl.className = 'pslot';
        sl.style.left = n2(slot.ox) + 'mm'; sl.style.top = n2(slot.oy) + 'mm';
        sl.style.width = n2(W * slot.sc) + 'mm'; sl.style.height = n2(H * slot.sc) + 'mm';
        sl.innerHTML = pen.svg();
        psheet.appendChild(sl);
        if (plan.stand) {
          const base = SvgPen(W, H, { bg: '#ffffff' });
          drawStandBase(base, { x: 0, y: 0, w: W, h: H }, s);
          const sl2 = document.createElement('div'); sl2.className = 'pslot';
          sl2.style.left = n2(slot.ox) + 'mm'; sl2.style.top = n2(slot.oy + H + plan.gap) + 'mm';
          sl2.style.width = n2(W * slot.sc) + 'mm'; sl2.style.height = n2(H * slot.sc) + 'mm';
          sl2.innerHTML = base.svg();
          psheet.appendChild(sl2);
          psheet.insertAdjacentHTML('beforeend',
            `<svg class="pmarks" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SW} ${SH}"><line x1="0" y1="${n2(H + plan.gap / 2)}" x2="${SW}" y2="${n2(H + plan.gap / 2)}" stroke="#888" stroke-width="0.25" stroke-dasharray="2 2"/></svg>`);
        }
      }
      sheet.__sw = SW; sheet.__sh = SH;
      const ms = planMarksSVG(sheet);
      if (ms) psheet.insertAdjacentHTML('beforeend', ms);
      root.appendChild(psheet);
    }
    document.body.appendChild(root);
    try { await document.fonts.ready; } catch (e) {}
    await new Promise(r => setTimeout(r, 80));
    unbusy();
    let done = false;
    const cleanup = () => { if (done) return; done = true; root.remove(); try { removeRules(); } catch (e) {} window.__printCleanup = null; window.removeEventListener('afterprint', onAfter); clearTimeout(fallback); };
    const onAfter = () => setTimeout(cleanup, 4000);
    window.__printCleanup = cleanup;
    const fallback = setTimeout(cleanup, 120000);
    window.addEventListener('afterprint', onAfter);
    toast('Impressão: ' + plan.sheets.length + ' folha(s) — ' + modeLabel(s) + ' · escala 100%, margens Nenhuma');
    window.print();
  } catch (e) { console.error(e); toast('Erro ao preparar a impressão.'); unbusy(); }
}

/* ---------- projeto .json ---------- */
function exportProject() {
  try {
    const data = JSON.stringify({ app: 'calendar-studio', v: 1, state }, null, 0);
    downloadBlob(new Blob([data], { type: 'application/json' }), (docName() || 'calendario') + '.json');
    toast('Projeto salvo.');
  } catch (e) { toast('Erro ao salvar o projeto.'); }
}
async function importProject(file) {
  if (file.size > 12 * 1024 * 1024) { alert('Arquivo grande demais para um projeto do Calendar Studio.'); return; }
  busy('Abrindo projeto…');
  try {
    const d = JSON.parse(await file.text());
    const st = d && d.state ? d.state : d;
    if (!st || typeof st !== 'object') throw new Error('estrutura');
    state = migrate(st);
    past = []; future = []; currentPage = 0; _holCache = null; _evCache = null;
    syncDocControls(); render(); save(); fit();
    toast('Projeto carregado.');
  } catch (e) { console.error(e); alert('Arquivo de projeto inválido.'); }
  unbusy();
}
