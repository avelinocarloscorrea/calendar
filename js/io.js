/* Calendar Studio — js/io.js
   Exportar PDF vetorial (multipágina), PNG da página atual, impressão pronta
   (mesma imposição do PDF) e salvar/abrir projeto .json. Tudo no navegador —
   nada é enviado. (parte de app; carregado em ordem por index.html) */
"use strict";

const OUT_SHEETS = { a4: [210, 297], a3: [297, 420] };
function outSheet(id) { return OUT_SHEETS[id] || OUT_SHEETS.a4; }

/* ================== imposição ==================
   Mesma matemática do Planner (vendor/core/print.js).
   "real": 1 folha = 1 página no tamanho final; sangria opcional; marcas de
           corte numa faixa FORA da sangria; TrimBox/BleedBox no PDF.
   "fit":  página centralizada numa folha comum + marcas de corte. Peças
           pequenas (cartão de bolso) são repetidas para aproveitar a folha,
           com o verso espelhado para frente e verso.
   Cavalete: face em cima e base embaixo GIRADA 180° — dobrada em tenda, as
   duas faces ficam de pé (antes a de trás ficava de cabeça para baixo, A13).
   Cada folha: { slots:[{src,ox,oy,sc,rot,base}], marks, foldX, foldY, trimBox, bleedBox } */
function impositionPlan(nPages) {
  const s = state.settings, [W, H] = paperWH();
  const eff = effectiveExportMode();
  const mode = eff.mode === 'fit' ? 'fit' : 'real';
  const P = EPPrint, size = SIZES[s.size] || {};
  const stand = !!size.stand;
  const bleed = stand ? 0 : Math.max(0, s.bleedMm || 0);
  if (stand) {
    const gap = 6, sheetH = H * 2 + gap;
    const sheets = [];
    for (let i = 0; i < nPages; i++) sheets.push({
      slots: [{ src: i, ox: 0, oy: 0, sc: 1 }, { src: i, ox: 0, oy: H + gap, sc: 1, rot: 180, base: true }],
      marks: [], foldX: null, foldY: H + gap / 2, trimBox: { x: 0, y: 0, w: W, h: sheetH } });
    return { mode: 'real', paper: true, bleed: 0, sheetW: W, sheetH, sheets, stand, gap, faceH: H };
  }
  if (mode === 'real') {
    const marks = !!s.cropMarks && bleed > 0;
    const bx = P.boxes(W, H, { bleed, marks });
    const segs = marks ? P.markSegments(bx.trim, { bleed }) : [];
    const sheets = [];
    for (let i = 0; i < nPages; i++) sheets.push({ slots: [{ src: i, ox: bx.slug, oy: bx.slug, sc: 1 }], marks: segs, trimBox: bx.trim, bleedBox: bx.bleed });
    return { mode, paper: true, bleed, sheetW: bx.media.w, sheetH: bx.media.h, sheets };
  }
  const B = outSheet(eff.sheet);
  // peças pequenas: várias por folha (máximo aproveitamento, girando se couber mais)
  const grid = P.nUp(B[0], B[1], W, H, { margin: 5, marks: true, noRotate: true, lockSheet: false });
  if (size.pocket || (grid.count >= 4 && W <= 105 && H <= 105)) {
    const fw = grid.sheetW, fh = grid.sheetH;
    const trimBoxes = grid.slots.map(g => ({ x: g.x, y: g.y, w: W, h: H }));
    // linhas de corte compartilhadas: marcas nas bordas externas do bloco, uma por linha/coluna
    const bxL = grid.slots[0].x, byT = grid.slots[0].y, bxR = bxL + grid.cols * W, byB = byT + grid.rows * H;
    const segs = [], L = P.MARK.len, g = P.MARK.gap;
    for (let c = 0; c <= grid.cols; c++) { const x = bxL + c * W; segs.push([x, byT - g, x, byT - g - L], [x, byB + g, x, byB + g + L]); }
    for (let r = 0; r <= grid.rows; r++) { const y = byT + r * H; segs.push([bxL - g, y, bxL - g - L, y], [bxR + g, y, bxR + g + L, y]); }
    const block = { x: bxL, y: byT, w: bxR - bxL, h: byB - byT };
    const sheets = [];
    for (let i = 0; i < nPages; i++) {
      const back = size.pocket && i % 2 === 1;       // verso: espelhado para virar pela borda longa
      sheets.push({ slots: grid.slots.map(gs => { const r = back ? P.backRect({ x: gs.x, y: gs.y, w: W, h: H }, fw, fh, 'long') : gs; return { src: i, ox: r.x, oy: r.y, sc: 1 }; }),
        marks: segs, trimBox: block, bleedBox: block, trimBoxes });
    }
    return { mode, sheetW: fw, sheetH: fh, sheets, copies: grid.count, duplex: !!size.pocket };
  }
  let sw = B[0], sh = B[1];
  if (W > sw || H > sh) { sw = B[1]; sh = B[0]; }
  const reach = P.markReach();
  const sc = Math.min(1, (sw - 2 * (bleed + reach)) / W, (sh - 2 * (bleed + reach)) / H);
  const pw = W * sc, ph = H * sc, ox = (sw - pw) / 2, oy = (sh - ph) / 2;
  const trim = { x: ox, y: oy, w: pw, h: ph }, bl = { x: ox - bleed * sc, y: oy - bleed * sc, w: pw + 2 * bleed * sc, h: ph + 2 * bleed * sc };
  const segs = P.markSegments(trim, { bleed: bleed * sc });
  const sheets = [];
  for (let i = 0; i < nPages; i++) sheets.push({ slots: [{ src: i, ox, oy, sc }], marks: segs, trimBox: trim, bleedBox: bl });
  return { mode, bleed, sheetW: sw, sheetH: sh, sheets, scale: sc };
}
function sheetFileTag(s) {
  const color = s.pdfColor === 'cmyk' ? '-grafica-CMYK' : '';
  if (SIZES[s.size] && SIZES[s.size].stand) return '-cavalete' + color;
  const eff = effectiveExportMode();
  return (eff.mode === 'fit' ? '-' + (eff.sheet === 'a3' ? 'A3' : 'A4') + '-corte' : '') + color;
}
function modeLabel(s) {
  if (SIZES[s.size] && SIZES[s.size].stand) return 'mesa cavalete — dobrar ao meio';
  const eff = effectiveExportMode();
  const base = eff.mode === 'fit' ? `folha ${eff.sheet === 'a3' ? 'A3' : 'A4'} + marcas de corte` : 'tamanho real';
  return eff.auto ? base + ' (automático)' : base;
}
// desenha o conteúdo de um slot (página ou base do cavalete) — igual no PDF, prévia e impressão
function drawSlot(pen, pages, slot, plan) {
  const [W, H] = paperWH();
  if (slot.base) { drawStandBase(pen, { x: 0, y: 0, w: W, h: H }, state.settings); return; }
  drawPageInto(pen, pages[slot.src], slot.src, { screen: false, bleed: plan.bleed || 0 });
}

function docName() { return (state.settings.title || 'Calendario').replace(/[^\wÀ-ÿ .-]/g, '').trim().slice(0, 60); }

async function exportPDF() {
  if (typeof EPArt !== 'undefined') await EPArt.ensure(calUsedArt());   // ilustrações do catálogo
  const pages = expand();
  if (typeof resetPdfImages === 'function') resetPdfImages();
  const s = state.settings, [W, H] = paperWH();
  const plan = impositionPlan(pages.length);
  const cmyk = s.pdfColor === 'cmyk';
  busy('Gerando PDF — ' + plan.sheets.length + ' folha(s)…');
  await new Promise(r => setTimeout(r, 20));
  try {
    const out = [];
    for (let si = 0; si < plan.sheets.length; si++) {
      const sheet = plan.sheets[si];
      out.push(composeSheetPdf({ sheet, sheetW: plan.sheetW, sheetH: plan.sheetH, W, H, bg: '#ffffff', draw: (pen, slot) => drawSlot(pen, pages, slot, plan) }));
      if (si % 5 === 0) { busy('Folha ' + (si + 1) + ' / ' + plan.sheets.length + '…'); await new Promise(r => setTimeout(r, 0)); }
    }
    busy(cmyk ? 'Convertendo fotos e cores para CMYK (FOGRA39)…' : 'Incorporando fontes e montando o arquivo…'); await new Promise(r => setTimeout(r, 0));
    const bytes = await buildPDF(out, { color: s.pdfColor, inkSave: (s.inkSave || 0) / 100, title: docName() || 'Calendário', creator: 'Calendar Studio — Esmeralda Paper' });
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), (docName() || 'calendario') + sheetFileTag(s) + '.pdf');
    toast('PDF' + (cmyk ? ' para gráfica (CMYK · PDF/X-4)' : '') + ': ' + plan.sheets.length + ' folha(s) · ' + (bytes.length / 1024).toFixed(0) + ' KB · ' + modeLabel(s));
  } catch (e) { console.error(e); toast('Erro ao gerar o PDF.'); }
  unbusy();
}

async function exportPNG() {
  if (typeof EPArt !== 'undefined') await EPArt.ensure(calUsedArt());
  const pages = expand();
  const i = clamp(currentPage, 0, pages.length - 1);
  busy('Gerando PNG da página ' + (i + 1) + '…');
  try {
    const [W, H] = paperWH();
    const dpi = clamp(Math.round(num(state.settings.exportDPI, 300)), 150, 600);
    try { await document.fonts.ready; } catch (e) {}
    let svg = buildSVG(i, pages[i]);
    { const fcss = await embeddedFontStyle(svg); svg = svg.replace(/(<svg[^>]*>)/, m => m + fcss); }
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
  if (typeof EPArt !== 'undefined') await EPArt.ensure(calUsedArt());
  const pages = expand();
  const s = state.settings, [W, H] = paperWH();
  const eff = effectiveExportMode();
  const plan = impositionPlan(pages.length);
  busy('Preparando impressão — ' + plan.sheets.length + ' folha(s)…');
  await new Promise(r => setTimeout(r, 20));
  try {
    const old = document.getElementById('printRoot'); if (old) old.remove();
    if (window.__printCleanup) { try { window.__printCleanup(); } catch (e) {} window.__printCleanup = null; }
    const SW = n2(plan.sheetW), SH = n2(plan.sheetH);
    // @page com palavra-chave ("A4 landscape") em vez de milímetros faz o
    // navegador sincronizar sozinho o seletor Retrato/Paisagem do diálogo de
    // impressão (a forma numérica define o tamanho certo mas não o seletor,
    // o que confunde quem está imprimindo). Só quando a folha é um tamanho
    // padrão (modo 'fit'); no modo 'real' a folha é o próprio calendário
    // (tamanhos como ímã/mesa não têm palavra-chave equivalente em CSS).
    const sheetKw = plan.mode === 'fit' ? (eff && eff.sheet === 'a3' ? 'A3' : 'A4') : null;
    const pageSize = sheetKw ? sheetKw + ' ' + (SW > SH ? 'landscape' : 'portrait') : (SW + 'mm ' + SH + 'mm');
    const removeRules = installPrintRules([
      '@page{size:' + pageSize + ';margin:0}',
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
      const slots = sheet.slots.map(slot => {
        const pen = SvgPen(W, H, { bg: '#ffffff' });
        drawSlot(pen, pages, slot, plan);
        return { x: slot.ox, y: slot.oy, w: W * slot.sc, h: H * slot.sc, rot: slot.rot, svg: pen.svg() };
      });
      psheet.innerHTML = EPShell.sheetSVG({ w: plan.sheetW, h: plan.sheetH, slots, marks: sheet.marks, foldY: sheet.foldY, print: true })
        .replace('class="ep-sheet__svg"', 'class="pmarks"');
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
const PRESET_DROP = ['title', 'owner', 'coverPhoto', 'coverPhotoSrc', 'coverPhotoEdit', 'events'];
async function importProject(file) {
  if (file.size > 250 * 1024 * 1024) { alert('Arquivo grande demais para um projeto do Calendar Studio.'); return; }
  busy('Abrindo projeto…');
  try {
    const d = JSON.parse(await file.text());
    if (d && d.preset === true && d.settings && typeof d.settings === 'object') {
      pushHistory(); state = migrate({ ...state, settings: { ...state.settings, ...d.settings } });
      syncDocControls(); render(); save(); fit(); toast('Predefinição aplicada.'); unbusy(); return;
    }
    const st = d && d.state ? d.state : d;
    if (!st || typeof st !== 'object') throw new Error('estrutura');
    state = migrate(st);
    past = []; future = []; histMeta = []; currentPage = 0; _holCache = null; _evCache = null;
    if (typeof _dpiPxCache !== 'undefined') _dpiPxCache.clear();
    syncDocControls(); render(); save(); fit();
    toast('Projeto carregado.');
  } catch (e) { console.error(e); alert('Arquivo de projeto inválido.'); }
  unbusy();
}
