/* Planner Studio — js/pen.js
   "Caneta" única: os tipos de página (pages.js) desenham chamando os mesmos
   métodos, e a mesma rotina serve para a TELA (SVG) e para o PDF vetorial.
   Unidades sempre em mm, origem no canto superior-esquerdo da página, y p/ baixo.

   Métodos: line, rect, dot (ponto), circle, text, textWidth, fitText, wrapText,
            clip(x,y,w,h)/unclip()  — recorta o desenho a um retângulo.
   (parte de app; carregado em ordem por index.html) */
"use strict";

/* larguras (unidades / 1000) para os caracteres 32..126.
   Helvetica (sans) e Times-Roman (serif); Courier (mono) = 600 fixo. */
const HELV_W = [
  278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
  556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,
  1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,
  667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,
  333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,
  556,556,333,500,278,556,500,722,500,500,500,334,260,334,584
];
const TIMES_W = [
  250,333,408,500,500,833,778,180,333,333,500,564,250,333,250,278,
  500,500,500,500,500,500,500,500,500,500,278,278,564,564,564,444,
  921,722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,
  556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,
  333,444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,
  500,500,333,389,278,500,500,722,500,500,444,480,200,480,541
];
function charWidth(code, fam) {
  if (fam === 'mono') return 600;
  const W = fam === 'serif' ? TIMES_W : HELV_W;
  if (code >= 32 && code <= 126) return W[code - 32];
  if (code >= 0xC0 && code <= 0xFF) {
    const map = { 0xE7: 0x63, 0xC7: 0x43 };
    const base = map[code] || (code >= 0xE0 ? 0x61 : 0x41);
    return W[base - 32] || 500;
  }
  const extra = fam === 'serif'
    ? { 0x91: 333, 0x92: 333, 0x93: 444, 0x94: 444, 0x96: 500, 0x97: 1000, 0x95: 350, 0x80: 500, 0x85: 1000, 0xA0: 250 }
    : { 0x91: 191, 0x92: 191, 0x93: 333, 0x94: 333, 0x96: 556, 0x97: 1000, 0x95: 350, 0x80: 556, 0x85: 1000, 0xA0: 278 };
  return extra[code] != null ? extra[code] : (fam === 'serif' ? 500 : 556);
}
const WINANSI = { 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2013: 0x96, 0x2014: 0x97, 0x2022: 0x95, 0x20AC: 0x80, 0x2026: 0x85, 0xA0: 0x20 };
function toWinAnsi(str) {
  const out = [];
  for (const ch of String(str == null ? '' : str)) {
    let c = ch.codePointAt(0);
    if (WINANSI[c] != null) c = WINANSI[c];
    if (c > 0xFF) c = 0x3F;
    out.push(c);
  }
  return out;
}
function pdfString(str) {
  let s = '';
  for (const c of toWinAnsi(str)) {
    if (c === 0x28 || c === 0x29 || c === 0x5C) s += '\\' + String.fromCharCode(c);
    else if (c < 0x20) s += ' ';
    else if (c < 0x7F) s += String.fromCharCode(c);
    else s += '\\' + c.toString(8).padStart(3, '0');
  }
  return s;
}
function textAdvance(str, sizePt, bold, fam) {
  let w = 0;
  for (const c of toWinAnsi(str)) w += charWidth(c, fam);
  w = w / 1000 * sizePt;
  return bold ? w * 1.045 : w;
}
// família CSS p/ a tela (SVG) — casa aproximadamente com a fonte-padrão do PDF
const FAM_CSS = {
  sans: 'Arimo, Helvetica, Arial, sans-serif',
  serif: '"Times New Roman", Times, Georgia, serif',
  mono: '"Courier New", Courier, monospace',
};
// nome do recurso de fonte no PDF por família + estilo
const FAM_PDF = {
  sans: { reg: 'FR', bold: 'FB', it: 'FI' },
  serif: { reg: 'TR', bold: 'TB', it: 'TI' },
  mono: { reg: 'CR', bold: 'CB', it: 'CI' },
};
function hexRGB(hex) {
  hex = HEX.test(hex) ? hex : '#000000';
  if (hex.length === 4) hex = '#' + [...hex.slice(1)].map(c => c + c).join('');
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));

/* --- helpers de texto compartilhados (mesma medida em SVG e PDF) --- */
function penTextWidthMm(str, sizePt, bold, fam) { return textAdvance(str, sizePt, bold, fam) / PT; }
// maior tamanho (pt) que faz `str` caber em maxWmm, entre min e start.
function fitTextSize(str, maxWmm, startPt, minPt, bold, fam) {
  const lim = maxWmm * (fam && fam !== 'sans' ? 0.93 : 0.96);   // folga extra p/ fontes não embutidas
  let s = startPt;
  while (s > minPt && penTextWidthMm(str, s, bold, fam) > lim) s -= 0.5;
  return Math.max(minPt, Math.round(s * 2) / 2);
}
// quebra em linhas que cabem em maxWmm (mantém quebras \n).
function wrapTextLines(str, maxWmm, sizePt, bold, maxLines, fam) {
  const paras = String(str == null ? '' : str).split('\n');
  const out = [];
  for (const para of paras) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (penTextWidthMm(t, sizePt, bold, fam) > maxWmm && line) { out.push(line); line = w; }
      else line = t;
    }
    if (line) out.push(line);
  }
  if (maxLines && out.length > maxLines) { out.length = maxLines; out[maxLines - 1] = out[maxLines - 1].replace(/.$/, '…'); }
  return out;
}

/* ===================== SvgPen (tela) ===================== */
// contador global: cada <clipPath> ganha um id único no documento inteiro, senão
// vários SVGs na mesma página (páginas + miniaturas) colidem em "c1", "c2"… e o
// navegador recorta todo mundo pelo primeiro que encontrar.
let SVGPEN_CLIP_SEQ = 0;
function SvgPen(wMm, hMm, o = {}) {
  const parts = [];
  let openClips = 0, LS = 1;
  const P = 4;
  const n = v => (+v).toFixed(P).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  const sw = w => n((w == null ? 0.2 : w) * LS);
  const stroke = s => {
    const a = [`stroke="${s.color || '#000'}"`, `stroke-width="${sw(s.w)}"`];
    if (s.dash) a.push(`stroke-dasharray="${s.dash.map(n).join(' ')}"`);
    if (s.opacity != null) a.push(`stroke-opacity="${s.opacity}"`);
    if (s.cap) a.push(`stroke-linecap="${s.cap}"`);
    return a.join(' ');
  };
  const defs = [];
  const api = {
    isPdf: false,
    setLineScale(k) { LS = (+k > 0 ? +k : 1); },
    clip(x, y, w, h) {
      const id = 'c' + (++SVGPEN_CLIP_SEQ);
      defs.push(`<clipPath id="${id}"><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"/></clipPath>`);
      parts.push(`<g clip-path="url(#${id})">`); openClips++;
    },
    unclip() { if (openClips > 0) { parts.push('</g>'); openClips--; } },
    line(x1, y1, x2, y2, s = {}) { parts.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${stroke(s)}/>`); },
    rect(x, y, w, h, s = {}) {
      const a = [`x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"`, `fill="${s.fill || 'none'}"`];
      if (s.fill && s.fillOpacity != null) a.push(`fill-opacity="${s.fillOpacity}"`);
      if (s.stroke) a.push(`stroke="${s.stroke}" stroke-width="${sw(s.w)}"`);
      if (s.dash) a.push(`stroke-dasharray="${s.dash.map(n).join(' ')}"`);
      if (s.rx) a.push(`rx="${n(s.rx)}"`);
      parts.push(`<rect ${a.join(' ')}/>`);
    },
    dot(cx, cy, r, s = {}) { parts.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * Math.min(1.6, Math.sqrt(LS)))}" fill="${s.fill || '#000'}"${s.opacity != null ? ` fill-opacity="${s.opacity}"` : ''}/>`); },
    circle(cx, cy, r, s = {}) {
      const a = [`cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"`, `fill="${s.fill || 'none'}"`];
      if (s.stroke) a.push(`stroke="${s.stroke}" stroke-width="${sw(s.w)}"`);
      parts.push(`<circle ${a.join(' ')}/>`);
    },
    text(str, x, y, s = {}) {
      str = String(str == null ? '' : str);
      const size = (s.size || 9) / PT;
      const anchor = s.align === 'c' ? 'middle' : s.align === 'r' ? 'end' : 'start';
      const fam = FAM_CSS[s.family] || FAM_CSS.sans;
      const a = [`x="${n(x)}" y="${n(y)}"`, `font-size="${n(size)}"`, `font-family='${fam}'`,
        `fill="${s.color || '#000'}"`, `text-anchor="${anchor}"`];
      if (s.font === 'bold') a.push('font-weight="700"');
      if (s.font === 'it') a.push('font-style="italic"');
      if (s.baseline === 'middle') a.push('dominant-baseline="central"');
      else if (s.baseline === 'top') a.push('dominant-baseline="text-before-edge"');
      if (s.opacity != null) a.push(`opacity="${s.opacity}"`);
      if (s.tracking) a.push(`letter-spacing="${n(s.tracking)}"`);
      parts.push(`<text ${a.join(' ')}>${esc(str)}</text>`);
    },
    // imagem (logo/fundo) — data: URI. CSP permite img-src data:.
    image(href, x, y, w, h, s = {}) {
      if (!href || typeof href !== 'string' || href.slice(0, 5) !== 'data:') return;
      const a = [`x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"`,
        `preserveAspectRatio="${s.fit === 'cover' ? 'xMidYMid slice' : s.fit === 'stretch' ? 'none' : 'xMidYMid meet'}"`,
        `href="${esc(href)}"`];
      if (s.opacity != null) a.push(`opacity="${s.opacity}"`);
      parts.push(`<image ${a.join(' ')}/>`);
    },
    textWidth: penTextWidthMm, fitText: fitTextSize, wrapText: wrapTextLines,
    svg() {
      while (openClips > 0) api.unclip();
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(wMm)} ${n(hMm)}" ` +
        `width="${n(wMm)}mm" height="${n(hMm)}mm" preserveAspectRatio="xMidYMid meet" shape-rendering="geometricPrecision" text-rendering="geometricPrecision">` +
        (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
        `<rect width="${n(wMm)}" height="${n(hMm)}" fill="${o.bg || '#fff'}"/>` +
        parts.join('') + `</svg>`;
    },
  };
  return api;
}

/* registro de imagens para o PDF (data: URIs) — preenchido durante a montagem
   dos streams, consumido por buildPDF. */
const PDF_IMG = new Map();                 // dataURI -> nome ("Im1", …)
const PDF_GS = new Map();                  // opacidade (0-1) -> nome ("GSa1", …)
const clamp01 = v => Math.max(0, Math.min(1, +v || 0));
function resetPdfImages() { PDF_IMG.clear(); PDF_GS.clear(); }
function registerPdfImage(href) {
  if (!href || typeof href !== 'string' || href.slice(0, 5) !== 'data:') return null;
  let nm = PDF_IMG.get(href);
  if (!nm) { nm = 'Im' + (PDF_IMG.size + 1); PDF_IMG.set(href, nm); }
  return nm;
}
function registerPdfGS(alpha) {
  const a = Math.round(clamp01(alpha) * 100) / 100;
  let nm = PDF_GS.get(a);
  if (!nm) { nm = 'GSa' + (PDF_GS.size + 1); PDF_GS.set(a, nm); }
  return nm;
}

/* ===================== PdfPen (exportação) ===================== */
function PdfPen(wMm, hMm, offXMm = 0, offYMm = offXMm) {
  const H = hMm * PT, OX = offXMm * PT, OY = offYMm * PT;
  const ops = [];
  const P = 2;
  const n = v => { const s = (+v).toFixed(P); return s === '-0.00' || s === '-0.0' ? '0' : s.replace(/\.?0+$/, ''); };
  const X = mm => n(mm * PT + OX);
  const Y = mm => n(H - (mm * PT + OY));
  let curStroke = null, curFill = null, curDash = null, curW = null, LS = 1;
  const setStroke = c => { const k = c || '#000'; if (k !== curStroke) { const [r, g, b] = hexRGB(k); ops.push(`${n(r / 255)} ${n(g / 255)} ${n(b / 255)} RG`); curStroke = k; } };
  const setFill = c => { const k = c || '#000'; if (k !== curFill) { const [r, g, b] = hexRGB(k); ops.push(`${n(r / 255)} ${n(g / 255)} ${n(b / 255)} rg`); curFill = k; } };
  const setDash = d => { const k = d ? d.join(',') : ''; if (k !== curDash) { ops.push(d ? `[${d.map(v => n(v * PT)).join(' ')}] 0 d` : '[] 0 d'); curDash = k; } };
  const setW = w => { const v = n((w == null ? 0.2 : w) * PT * LS); if (v !== curW) { ops.push(`${v} w`); curW = v; } };
  const api = {
    isPdf: true,
    setLineScale(k) { LS = (+k > 0 ? +k : 1); },
    clip(x, y, w, h) { ops.push(`q ${X(x)} ${Y(y + h)} ${n(w * PT)} ${n(h * PT)} re W n`); },
    unclip() { ops.push('Q'); curStroke = curFill = curDash = curW = null; },
    line(x1, y1, x2, y2, s = {}) {
      setStroke(s.color); setDash(s.dash); setW(s.w);
      if (s.cap) ops.push(`${s.cap === 'round' ? 1 : s.cap === 'square' ? 2 : 0} J`);
      ops.push(`${X(x1)} ${Y(y1)} m ${X(x2)} ${Y(y2)} l S`);
      if (s.cap) ops.push('0 J');
    },
    rect(x, y, w, h, s = {}) {
      const re = `${X(x)} ${Y(y + h)} ${n(w * PT)} ${n(h * PT)} re`;
      if (s.fill) {
        const a = s.fillOpacity != null && s.fillOpacity < 1 ? clamp01(s.fillOpacity) : 1;
        if (a < 1) { ops.push(`q /${registerPdfGS(a)} gs`); setFill(s.fill); ops.push(`${re} f Q`); curFill = null; }
        else { setFill(s.fill); ops.push(`${re} f`); }
      }
      if (s.stroke) { setStroke(s.stroke); setDash(s.dash); setW(s.w); ops.push(`${re} S`); }
    },
    dot(cx, cy, r, s = {}) {                       // ponto = quadradinho (1 op, barato)
      setFill(s.fill || '#000');
      const rr = r * Math.min(1.6, Math.sqrt(LS)), d = n(rr * 2 * PT);
      ops.push(`${X(cx - rr)} ${Y(cy + rr)} ${d} ${d} re f`);
    },
    circle(cx, cy, r, s = {}) {
      const k = 0.5523, rp = r * PT, x = cx * PT + OX, y = H - (cy * PT + OY);
      const c = `${X(cx - r)} ${n(y)} m ` +
        `${n(x - rp)} ${n(y + k * rp)} ${n(x - k * rp)} ${n(y + rp)} ${n(x)} ${n(y + rp)} c ` +
        `${n(x + k * rp)} ${n(y + rp)} ${n(x + rp)} ${n(y + k * rp)} ${n(x + rp)} ${n(y)} c ` +
        `${n(x + rp)} ${n(y - k * rp)} ${n(x + k * rp)} ${n(y - rp)} ${n(x)} ${n(y - rp)} c ` +
        `${n(x - k * rp)} ${n(y - rp)} ${n(x - rp)} ${n(y - k * rp)} ${n(x - rp)} ${n(y)} c`;
      if (s.fill) { setFill(s.fill); ops.push(`${c} f`); }
      if (s.stroke) { setStroke(s.stroke); setW(s.w); ops.push(`${c} S`); }
    },
    text(str, x, y, s = {}) {
      str = String(str == null ? '' : str);
      if (!str) return;
      const size = s.size || 9;
      const famTab = FAM_PDF[s.family] || FAM_PDF.sans;
      const key = s.font === 'bold' ? famTab.bold : s.font === 'it' ? famTab.it : famTab.reg;
      let tx = x;
      const w = textAdvance(str, size, s.font === 'bold', s.family);
      if (s.align === 'c') tx = x - w / 2 / PT;
      else if (s.align === 'r') tx = x - w / PT;
      let by = y;
      if (s.baseline === 'middle') by = y + size * 0.34 / PT;
      else if (s.baseline === 'top') by = y + size * 0.80 / PT;
      setFill(s.color);
      ops.push('BT');
      if (s.tracking) ops.push(`${n(s.tracking * PT)} Tc`);
      ops.push(`/${key} ${n(size)} Tf ${X(tx)} ${Y(by)} Td (${pdfString(str)}) Tj`);
      if (s.tracking) ops.push('0 Tc');
      ops.push('ET');
    },
    image(href, x, y, w, h, s = {}) {
      const nm = registerPdfImage(href); if (!nm) return;
      // espaço da imagem é o quadrado unitário; cm mapeia para dw×dh pt.
      // "meet" (cabe inteira) e "cover" (preenche e recorta) respeitam a
      // proporção real da imagem — igual ao preserveAspectRatio do SVG da tela.
      let dx = x, dy = y, dw = w, dh = h, clipBox = false;
      const dim = (s.fit === 'meet' || s.fit === 'cover') ? imageDims(href) : null;
      if (dim && dim.w > 0 && dim.h > 0) {
        const k = s.fit === 'meet' ? Math.min(w / dim.w, h / dim.h) : Math.max(w / dim.w, h / dim.h);
        dw = dim.w * k; dh = dim.h * k; dx = x + (w - dw) / 2; dy = y + (h - dh) / 2;
        clipBox = s.fit === 'cover';
      }
      ops.push('q');
      if (clipBox) ops.push(`${X(x)} ${Y(y + h)} ${n(w * PT)} ${n(h * PT)} re W n`);
      ops.push(`${n(dw * PT)} 0 0 ${n(dh * PT)} ${X(dx)} ${Y(dy + dh)} cm /${nm} Do Q`);
      curStroke = curFill = curDash = curW = null;
    },
    textWidth: penTextWidthMm, fitText: fitTextSize, wrapText: wrapTextLines,
    stream() { return ops.join('\n'); },
  };
  return api;
}

/* dimensões (px) de um data: URI de imagem, lidas do cabeçalho — síncrono,
   sem decodificar a imagem (PNG, JPEG, GIF, WebP). null se não reconhecer. */
const _dimCache = new Map();
function imageDims(href) {
  if (_dimCache.has(href)) return _dimCache.get(href);
  let out = null;
  try {
    const i = href.indexOf(','); const b64 = href.slice(i + 1, i + 1 + 64000);
    const bin = atob(b64.slice(0, b64.length - (b64.length % 4)));
    const u = k => bin.charCodeAt(k);
    const be16 = k => (u(k) << 8) | u(k + 1), be32 = k => ((u(k) << 24) >>> 0) + (u(k + 1) << 16) + (u(k + 2) << 8) + u(k + 3);
    if (bin.slice(1, 4) === 'PNG') out = { w: be32(16), h: be32(20) };
    else if (bin.slice(0, 3) === 'GIF') out = { w: u(6) | (u(7) << 8), h: u(8) | (u(9) << 8) };
    else if (u(0) === 0xFF && u(1) === 0xD8) {
      let k = 2;
      while (k < bin.length - 9) {
        if (u(k) !== 0xFF) { k++; continue; }
        const m = u(k + 1);
        if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) { out = { h: be16(k + 5), w: be16(k + 7) }; break; }
        k += 2 + be16(k + 2);
      }
    } else if (bin.slice(0, 4) === 'RIFF' && bin.slice(8, 12) === 'WEBP') {
      const t = bin.slice(12, 16);
      if (t === 'VP8X') out = { w: 1 + (u(24) | (u(25) << 8) | (u(26) << 16)), h: 1 + (u(27) | (u(28) << 8) | (u(29) << 16)) };
      else if (t === 'VP8L') { const b0 = u(21), b1 = u(22), b2 = u(23), b3 = u(24); out = { w: 1 + (((b1 & 0x3F) << 8) | b0), h: 1 + (((b3 & 0xF) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6)) }; }
      else if (t === 'VP8 ') out = { w: (u(26) | (u(27) << 8)) & 0x3FFF, h: (u(28) | (u(29) << 8)) & 0x3FFF };
    }
  } catch (e) { out = null; }
  _dimCache.set(href, out);
  return out;
}

/* JPEG pronto para o PDF: bytes originais + largura/altura/componentes (do SOF) */
function jpegPassthrough(href) {
  if (!/^data:image\/jpeg;base64,/i.test(href)) return null;
  try {
    const bin = atob(href.slice(href.indexOf(',') + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
    let k = 2;
    while (k < bytes.length - 9) {
      if (bytes[k] !== 0xFF) { k++; continue; }
      const m = bytes[k + 1];
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        const h = (bytes[k + 5] << 8) | bytes[k + 6], w = (bytes[k + 7] << 8) | bytes[k + 8], comps = bytes[k + 9];
        if (!w || !h || ![1, 3, 4].includes(comps)) return null;
        return { w, h, comps, bytes };
      }
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { k += 2; continue; }
      k += 2 + ((bytes[k + 2] << 8) | bytes[k + 3]);
    }
  } catch (e) {}
  return null;
}

/* decodifica um data: URI de imagem para bytes RGB (+ máscara alfa) via canvas */
async function decodeImageRGBA(dataURI) {
  const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('img')); im.src = dataURI; });
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('dim');
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
  const d = cx.getImageData(0, 0, w, h).data;
  const rgb = new Uint8Array(w * h * 3), al = new Uint8Array(w * h);
  let hasA = false;
  for (let i = 0, j = 0, k = 0; k < w * h; i += 4, j += 3, k++) { rgb[j] = d[i]; rgb[j + 1] = d[i + 1]; rgb[j + 2] = d[i + 2]; al[k] = d[i + 3]; if (d[i + 3] !== 255) hasA = true; }
  return { w, h, rgb, alpha: hasA ? al : null };
}

/* ===================== escritor de PDF (multipágina, vetorial) =====================
   pages = [{ stream, wPt, hPt }]. Fontes padrão compartilhadas (não embutidas).
   - streams idênticos são gravados uma única vez (dedupe);
   - conteúdo é comprimido com deflate quando o navegador tiver CompressionStream. */
async function deflate(bytes) {
  try {
    if (typeof CompressionStream === 'undefined') return null;
    const cs = new CompressionStream('deflate');
    const blob = await new Response(new Blob([bytes]).stream().pipeThrough(cs)).blob();
    return new Uint8Array(await blob.arrayBuffer());
  } catch (e) { return null; }
}
async function buildPDF(pages) {
  const enc = new TextEncoder();
  const chunks = []; let len = 0;
  const out = d => { const u = (d instanceof Uint8Array) ? d : enc.encode(d); chunks.push(u); len += u.length; };

  // dedupe de streams
  const contentByKey = new Map();   // stream -> objNum
  const N = pages.length;
  // 3 famílias × 3 estilos = objetos 3..11 (fontes-padrão, não embutidas)
  const FR = 3, FB = 4, FI = 5, TR = 6, TB = 7, TI = 8, CR = 9, CB = 10, CI = 11;
  let nextObj = 12;
  const contentObjs = [];           // {num, bytes, filter}
  const pageContentNum = [];
  for (let i = 0; i < N; i++) {
    const st = pages[i].stream;
    let num = contentByKey.get(st);
    if (num == null) {
      num = nextObj++;
      contentByKey.set(st, num);
      let bytes = enc.encode(st), filter = null;
      const z = await deflate(bytes);
      if (z && z.length < bytes.length * 0.92) { bytes = z; filter = '/FlateDecode'; }
      contentObjs.push({ num, bytes, filter });
    }
    pageContentNum.push(num);
  }
  // imagens (XObjects) — decodifica cada data: URI e monta o objeto (+ SMask alfa)
  const imgObjs = [];               // {num, dict, bytes}
  let imgRes = '';
  for (const [href, nm] of PDF_IMG.entries()) {
    // JPEG entra como está (DCTDecode): mesma qualidade e ~10× menor do que
    // descomprimir para RGB cru + Flate — um calendário com 13 fotos caía
    // de dezenas de MB para poucos MB. JPEG não tem transparência, então não
    // precisa de SMask.
    const jpg = jpegPassthrough(href);
    if (jpg) {
      const num = nextObj++;
      const cs = jpg.comps === 1 ? '/DeviceGray' : jpg.comps === 4 ? '/DeviceCMYK /Decode [1 0 1 0 1 0 1 0]' : '/DeviceRGB';
      imgObjs.push({ num, dict: `<< /Type /XObject /Subtype /Image /Width ${jpg.w} /Height ${jpg.h} /ColorSpace ${cs} /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.bytes.length} >>`, bytes: jpg.bytes });
      imgRes += `/${nm} ${num} 0 R `;
      continue;
    }
    let dec = null;
    try { dec = await decodeImageRGBA(href); } catch (e) { continue; }
    let rgbBytes = dec.rgb, rgbFilter = '';
    const zr = await deflate(rgbBytes);
    if (zr) { rgbBytes = zr; rgbFilter = ' /Filter /FlateDecode'; }
    let smaskRef = '';
    if (dec.alpha) {
      const smNum = nextObj++;
      let aBytes = dec.alpha, aFilter = '';
      const za = await deflate(aBytes);
      if (za) { aBytes = za; aFilter = ' /Filter /FlateDecode'; }
      imgObjs.push({ num: smNum, dict: `<< /Type /XObject /Subtype /Image /Width ${dec.w} /Height ${dec.h} /ColorSpace /DeviceGray /BitsPerComponent 8${aFilter} /Length ${aBytes.length} >>`, bytes: aBytes });
      smaskRef = ` /SMask ${smNum} 0 R`;
    }
    const num = nextObj++;
    imgObjs.push({ num, dict: `<< /Type /XObject /Subtype /Image /Width ${dec.w} /Height ${dec.h} /ColorSpace /DeviceRGB /BitsPerComponent 8${rgbFilter}${smaskRef} /Length ${rgbBytes.length} >>`, bytes: rgbBytes });
    imgRes += `/${nm} ${num} 0 R `;
  }
  // ExtGStates (opacidade do véu de legibilidade sobre a imagem de fundo)
  const gsObjs = []; let gsRes = '';
  for (const [a, nm] of PDF_GS.entries()) { const num = nextObj++; gsObjs.push({ num, a }); gsRes += `/${nm} ${num} 0 R `; }

  const pageObjStart = nextObj;
  const total = pageObjStart - 1 + N;
  const off = [];
  out('%PDF-1.4\n'); out(new Uint8Array([37, 226, 227, 207, 211, 10]));
  const obj = (num, f) => { off[num] = len; out(num + ' 0 obj\n'); f(); out('\nendobj\n'); };
  obj(1, () => out('<< /Type /Catalog /Pages 2 0 R >>'));
  const kids = [];
  for (let i = 0; i < N; i++) kids.push((pageObjStart + i) + ' 0 R');
  obj(2, () => out(`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${N} >>`));
  const fontObj = (num, base) => obj(num, () => out(`<< /Type /Font /Subtype /Type1 /BaseFont /${base} /Encoding /WinAnsiEncoding >>`));
  fontObj(FR, 'Helvetica'); fontObj(FB, 'Helvetica-Bold'); fontObj(FI, 'Helvetica-Oblique');
  fontObj(TR, 'Times-Roman'); fontObj(TB, 'Times-Bold'); fontObj(TI, 'Times-Italic');
  fontObj(CR, 'Courier'); fontObj(CB, 'Courier-Bold'); fontObj(CI, 'Courier-Oblique');
  for (const co of contentObjs) {
    obj(co.num, () => {
      out(`<< /Length ${co.bytes.length}${co.filter ? ' /Filter ' + co.filter : ''} >>\nstream\n`);
      out(co.bytes); out('\nendstream');
    });
  }
  for (const io2 of imgObjs) {
    obj(io2.num, () => { out(io2.dict + '\nstream\n'); out(io2.bytes); out('\nendstream'); });
  }
  for (const g of gsObjs) obj(g.num, () => out(`<< /Type /ExtGState /ca ${g.a} /CA ${g.a} >>`));
  const xobjRes = imgRes ? ` /XObject << ${imgRes}>>` : '';
  const gsResStr = gsRes ? ` /ExtGState << ${gsRes}>>` : '';
  for (let i = 0; i < N; i++) {
    obj(pageObjStart + i, () => out(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pages[i].wPt.toFixed(2)} ${pages[i].hPt.toFixed(2)}] ` +
      `/Resources << /Font << /FR ${FR} 0 R /FB ${FB} 0 R /FI ${FI} 0 R ` +
      `/TR ${TR} 0 R /TB ${TB} 0 R /TI ${TI} 0 R /CR ${CR} 0 R /CB ${CB} 0 R /CI ${CI} 0 R >>${xobjRes}${gsResStr} >> ` +
      `/Contents ${pageContentNum[i]} 0 R >>`));
  }
  const xref = len;
  out(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
  for (let k = 1; k <= total; k++) out(String(off[k] || 0).padStart(10, '0') + ' 00000 n \n');
  out(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const buf = new Uint8Array(len); let p = 0;
  for (const c of chunks) { buf.set(c, p); p += c.length; }
  PDF_IMG.clear(); PDF_GS.clear();
  return buf;
}
