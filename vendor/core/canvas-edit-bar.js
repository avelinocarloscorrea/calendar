/* packages/core/canvas-edit-bar.js — EPCanvasEditBar
 *
 * Barra de ferramentas da edição na folha (usada por canvas-edit.js).
 * Estilo Canva: UMA fileira de ícones; fonte, tamanho e cor abrem um painel
 * pequeno logo acima (celular) ou abaixo (computador) da fileira — a folha
 * continua visível. No celular a barra fica no rodapé, no lugar das abas;
 * no computador, no topo da prancheta.
 *
 *   const bar = EPCanvasEditBar.create(ctx)
 *     ctx: { o, cur(), item(), data(), mobile(), place(), move(), select(page,key), clear(), editText(), photoTools() }
 *   bar.open()  bar.close()  bar.position()  bar.el
 */
(function (root) {
  "use strict";
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
  const I = {
    minus: '<path d="M5 12h14"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    bold: '<path d="M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z"/>',
    center: '<path d="M12 3v18"/><rect x="6" y="8" width="12" height="8" rx="1.5"/>',
    reset: '<path d="M4 12a8 8 0 108-8"/><path d="M4 4v5h5"/>',
    hide: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0112 5c5.5 0 9 7 9 7a16 16 0 01-3.2 4.2M6.2 6.2A15.7 15.7 0 003 12s3.5 7 9 7a9.6 9.6 0 004.2-1"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>',
    art: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    type: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    size: '<path d="M3 7V5h10v2M8 5v14M6 19h4"/><path d="M14 12v-1.5h7V12M17.5 10.5V19M16 19h3"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
    front: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 012-2h10"/>',
  };
  const svg = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
  const famCss = v => { const F = root.EPFontMetrics && root.EPFontMetrics.families && root.EPFontMetrics.families[v]; return F ? F.css : ''; };

  function create(ctx) {
    const o = ctx.o;
    let el = null, panel = '';          // painel aberto: '' | 'font' | 'size' | 'color'

    function close() {
      if (el) { el.remove(); el = null; }
      document.body.classList.remove('ce-bar-open');
    }
    const tool = (a, icon, label, extra) =>
      `<button type="button" class="ce-tool${extra || ''}" data-ce="${a}" title="${esc(label)}">${icon}<span>${esc(label)}</span></button>`;

    function toolsHTML(it, f) {
      const k = it.kind, isText = k === 'text', mob = ctx.mobile();
      const colorable = isText || f.colorable;
      let h = '';
      if (isText && f.text != null) h += tool('edit', svg('edit'), 'Editar');
      if (isText) {
        const lab = (o.fonts || []).find(x => x.v === f.fam);
        h += tool('font', svg('type'), mob ? 'Fonte' : (lab ? lab.label : 'Fonte padrão'), ' ce-tool--font' + (panel === 'font' ? ' on' : ''));
      }
      if ((k === 'image' || k === 'art') && f.canReplace) h += tool('image', svg(k === 'art' ? 'art' : 'image'), 'Trocar');
      h += tool('size', svg('size'), mob ? 'Tamanho' : Math.round((f.s || 1) * 100) + '%', panel === 'size' ? ' on' : '');
      if (colorable) h += `<button type="button" class="ce-tool${panel === 'color' ? ' on' : ''}" data-ce="color-panel" title="Cor"><i class="ce-dot" data-dot="${esc(f.color || '')}"></i><span>Cor</span></button>`;
      if (isText) h += tool('bold', svg('bold'), 'Negrito', f.bold ? ' on' : '');
      h += tool('center', svg('center'), 'Centralizar');
      if (f.duplicable) h += tool('duplicate', svg('copy'), 'Duplicar');
      h += tool('reset', svg('reset'), 'Restaurar');
      h += f.removable ? tool('delete', svg('trash'), 'Excluir', ' is-danger') : tool('hide', svg('hide'), 'Ocultar');
      return h;
    }
    function panelHTML(f) {
      if (panel === 'font') {
        return `<div class="ce-panel ce-panel--font"><button type="button" class="ce-fontchip${f.fam ? '' : ' on'}" data-ce="fam" data-v="">Padrão</button>` +
          (o.fonts || []).map(x => `<button type="button" class="ce-fontchip${x.v === f.fam ? ' on' : ''}" data-ce="fam" data-v="${esc(x.v)}" data-css="${esc(famCss(x.v))}">${esc(x.label)}</button>`).join('') + '</div>';
      }
      if (panel === 'size') {
        const p = Math.round((f.s || 1) * 100);
        return `<div class="ce-panel ce-panel--size"><button type="button" class="ce-ib" data-ce="smaller" title="Menor">${svg('minus')}</button>` +
          `<input type="range" class="ce-range" data-ce="srange" min="25" max="400" step="1" value="${clamp(p, 25, 400)}" aria-label="Tamanho">` +
          `<button type="button" class="ce-ib" data-ce="bigger" title="Maior">${svg('plus')}</button><output class="ce-sval">${p}%</output></div>`;
      }
      if (panel === 'color') {
        const colors = (o.colors && o.colors(ctx.cur().page)) || [], c0 = (f.color || '').toLowerCase();
        return `<div class="ce-panel ce-panel--color"><button type="button" class="ce-sw ce-sw--auto${f.color ? '' : ' on'}" data-ce="color" data-c="" title="Cor do estilo">A</button>` +
          colors.map(c => `<button type="button" class="ce-sw${c0 === c.toLowerCase() ? ' on' : ''}" data-ce="color" data-c="${c}" title="${c}"><i data-c="${c}"></i></button>`).join('') +
          `<label class="ce-sw ce-sw--pick" title="Outra cor"><input type="color" data-ce="colorpick" value="${/^#[0-9a-f]{6}$/i.test(f.color || '') ? f.color : '#333333'}"></label></div>`;
      }
      return '';
    }

    // página tocada sem elemento: barra "Adicionar" (texto, ilustração, imagem…)
    function openAdd(cur) {
      if (!o.addTools) return close();
      const mob = ctx.mobile();
      if (el) el.remove();
      el = document.createElement('div');
      el.className = 'ce-bar ce-bar--add ' + (mob ? 'ce-bar--sheet' : 'ce-bar--top');
      el.innerHTML = `<div class="ce-tools">${mob ? '' : '<b class="ce-bar__name">Adicionar</b>'}` +
        o.addTools.map(t => `<button type="button" class="ce-tool" data-add="${esc(t.a)}" title="${esc(t.title || t.label)}">${t.icon}<span>${esc(t.label)}</span></button>`).join('') +
        `<button type="button" class="ce-done" data-ce="close" title="Concluir (Esc)">${svg('check')}<span>Concluir</span></button></div>`;
      document.body.appendChild(el);
      document.body.classList.add('ce-bar-open');
      position();
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-add],[data-ce]'); if (!b) return;
        if (b.dataset.ce === 'close') { ctx.clear(); return; }
        o.add(cur.page, b.dataset.add);
      });
    }

    function open() {
      const cur = ctx.cur(); if (!cur) return close();
      if (!cur.key) return openAdd(cur);
      const it = ctx.item(), f = it && o.get(cur.page, cur.key);
      if (!it || !f) return close();
      const mob = ctx.mobile();
      const keepScroll = el && el.querySelector('.ce-tools') ? el.querySelector('.ce-tools').scrollLeft : 0;
      const hadPanelScroll = el && el.querySelector('.ce-panel') ? el.querySelector('.ce-panel').scrollLeft : 0;
      if (el) el.remove();
      el = document.createElement('div');
      el.className = 'ce-bar ' + (mob ? 'ce-bar--sheet' : 'ce-bar--top');
      const done = `<button type="button" class="ce-done" data-ce="close" title="Concluir (Esc)">${svg('check')}<span>Concluir</span></button>`;
      if (it.kind === 'photo') {
        el.className += ' ce-bar--photo';
        el.innerHTML = `<div class="ce-bar__head"><b>${esc(it.label || 'Foto')}</b><span class="ce-bar__hint">Arraste a foto na folha para enquadrar · pinça ou roda para zoom</span></div>` +
          '<div class="ce-bar__tools-slot"></div>' +
          `<div class="ce-tools">${f.canReplace ? tool('image', svg('image'), 'Trocar foto') : ''}${f.removable ? tool('delete', svg('trash'), 'Remover', ' is-danger') : ''}${done}</div>`;
        const pt = ctx.photoTools(); if (pt) el.querySelector('.ce-bar__tools-slot').replaceWith(pt);
        else el.querySelector('.ce-bar__tools-slot').remove();
      } else {
        el.innerHTML = panelHTML(f) + `<div class="ce-tools">${mob ? '' : `<b class="ce-bar__name">${esc(it.label || '')}</b>`}${toolsHTML(it, f)}${done}</div>`;
      }
      el.querySelectorAll('i[data-c]').forEach(i => { i.style.background = i.dataset.c; });
      el.querySelectorAll('[data-dot]').forEach(i => { if (i.dataset.dot) i.style.background = i.dataset.dot; else i.classList.add('is-auto'); });
      el.querySelectorAll('[data-css]').forEach(b => { if (b.dataset.css) b.style.fontFamily = b.dataset.css; });
      document.body.appendChild(el);
      document.body.classList.add('ce-bar-open');
      const ts = el.querySelector('.ce-tools'); if (ts) ts.scrollLeft = keepScroll;
      const ps = el.querySelector('.ce-panel'); if (ps) {
        ps.scrollLeft = hadPanelScroll;
        const on = ps.querySelector('.on'); if (on && !hadPanelScroll && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
      }
      position();
      bind(cur.page, cur.key);
    }

    // computador: barra centralizada no topo da prancheta (painel da foto ao lado da página)
    function position() {
      if (!el) return;
      const cur = ctx.cur(); if (!cur) return;
      if (ctx.mobile()) { el.style.left = el.style.top = el.style.width = ''; return; }
      const sc = o.scroller && o.scroller();
      const r = sc ? sc.getBoundingClientRect() : { left: 0, top: 60, width: innerWidth, height: innerHeight - 60 };
      if (el.classList.contains('ce-bar--photo')) {
        const pr = cur.page.getBoundingClientRect();
        const leftFree = pr.left - r.left, rightFree = r.left + r.width - pr.right;
        const x = rightFree > leftFree ? Math.min(r.left + r.width - 312, pr.right + 12) : Math.max(r.left + 12, pr.left - 312);
        el.style.width = '300px'; el.style.left = x + 'px'; el.style.top = (r.top + 12) + 'px';
        el.style.maxHeight = Math.max(240, r.height - 24) + 'px';
        return;
      }
      el.style.width = '';
      const bw = Math.min(r.width - 24, el.offsetWidth);
      el.style.left = (r.left + (r.width - bw) / 2) + 'px';
      el.style.top = (r.top + 12) + 'px';
    }

    function bind(page, k) {
      const again = () => { ctx.place(); };
      const setS = (s, live) => o.set(page, k, { s: clamp(Math.round(s * 100) / 100, 0.25, 5) }, { live });
      const step = d => { const f = o.get(page, k) || {}; o.begin(page, k); setS((+f.s || 1) + d, false); again(); };
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-ce]'); if (!b) return;
        const a = b.dataset.ce;
        if (a === 'close') { ctx.select(page, null); return; }
        if (a === 'font' || a === 'size' || a === 'color-panel') { const p = a === 'color-panel' ? 'color' : a; panel = panel === p ? '' : p; open(); return; }
        if (a === 'edit') { panel = ''; ctx.editText(); return; }
        if (a === 'smaller') step(-0.05);
        else if (a === 'bigger') step(0.05);
        else if (a === 'fam') { o.begin(page, k); o.set(page, k, { fam: b.dataset.v || null }, { live: false }); again(); }
        else if (a === 'bold') { const f = o.get(page, k); o.begin(page, k); o.set(page, k, { bold: !f.bold }, { live: false }); again(); }
        else if (a === 'color') { o.begin(page, k); o.set(page, k, { color: b.dataset.c || null }, { live: false }); again(); }
        else if (a === 'center') {
          const it = ctx.item(), f = o.get(page, k), d = ctx.data();
          o.begin(page, k); o.set(page, k, { dx: Math.round(((+f.dx || 0) + d.w / 2 - (it.x + it.w / 2)) * 10) / 10 }, { live: false }); again();
        } else if (/^(reset|hide|delete|image|duplicate)$/.test(a)) {
          panel = '';
          o.begin(page, k); const res = o.action(page, k, a);
          if (a === 'hide' || a === 'delete') ctx.select(page, null);
          else if (a === 'duplicate' && typeof res === 'string') ctx.select(page, res);
          else again();
        }
      });
      const r = el.querySelector('[data-ce="srange"]');
      if (r) {
        let began = false;
        const out = el.querySelector('.ce-sval');
        r.addEventListener('input', () => { if (!began) { o.begin(page, k); began = true; } setS(r.value / 100, true); out.textContent = r.value + '%'; ctx.move(); });
        r.addEventListener('change', () => { began = false; setS(r.value / 100, false); again(); });
      }
      const cp = el.querySelector('[data-ce="colorpick"]');
      if (cp) {
        cp.addEventListener('input', () => o.set(page, k, { color: cp.value }, { live: true }));
        cp.addEventListener('change', () => { o.begin(page, k); o.set(page, k, { color: cp.value }, { live: false }); again(); });
      }
    }

    return {
      open, close, position,
      reset() { panel = ''; },
      get el() { return el; },
    };
  }

  root.EPCanvasEditBar = { create, icon: svg };
})(typeof window !== 'undefined' ? window : globalThis);
