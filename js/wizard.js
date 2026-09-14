/* Calendar Studio — js/wizard.js
   Tela inicial: modelos prontos OU "montar passo a passo" em 7 passos curtos
   — tamanho → estilo do mês → capa (nome, título e estilo) → cores → datas e
   feriados → encadernação → resumo. Toda miniatura é a página REAL desenhada
   pelo mesmo motor da tela/PDF (com fotos de exemplo), com as escolhas
   acumuladas até ali. Tocar de novo numa escolha avança.
   (parte de app; carregado depois de ui.js — usa pageSVGFor/pairThumbHTML de shell-ui.js) */
"use strict";

const WIZ_SIZES = [
  { id: 'a4p', label: 'Parede A4', desc: 'retrato · 210×297 mm' },
  { id: 'a3p', label: 'Pôster A3', desc: 'retrato · bem grande' },
  { id: 'a4l', label: 'Parede A4 deitado', desc: 'paisagem · 297×210 mm' },
  { id: 'square', label: 'Quadrado', desc: '210×210 mm' },
  { id: 'a6l', label: 'Mesa A6', desc: 'paisagem · cabe na escrivaninha' },
  { id: 'magnet', label: 'Ímã de geladeira', desc: 'bem pequeno · 100×140 mm' },
  { id: 'standee', label: 'Cavalete de mesa', desc: 'dobra ao meio e fica de pé' },
].filter(o => SIZES[o.id]);

let wizStep = 0;
let wizDraft = null;
const wizDefaultDraft = () => ({ size: 'a4p', style: 'sografe', palette: 'esmeralda', binding: 'none', showCover: true, coverStyle: 'script',
  title: 'Calendário', owner: '', uf: '', holComemorativa: false, startMonth: 1, weekStart: 'mon' });

// página real com as escolhas do rascunho (fotos de exemplo nos estilos com foto)
function wizPageSVG(d, pd) {
  const saved = state;
  try {
    state = newState();
    applyTemplate({ settings: { ...d, showPunch: !!(BINDING_TYPES[d.binding] || {}).edge } });
    const ph = samplePhotos();
    state.months.forEach((mo, i) => { mo.photo = ph[i % ph.length]; });
    state.settings.coverPhoto = ph[0];
    return pageSVGFor(pd, 0);
  } finally { state = saved; }
}
function wizThumb(d, pd, back) {
  const sz = SIZES[d.size] || SIZES.a4p;
  return pairThumbHTML(wizPageSVG(d, pd), back ? wizPageSVG(d, back) : null, sz.w, sz.h);
}
const WIZ_MONTH = { kind: 'month', m: 1 }, WIZ_COVER = { kind: 'cover' };

const WIZ_STEPS = [
  { title: 'Que tamanho de calendário?', desc: 'Define o formato e como ele vai ser pendurado ou apoiado.',
    options: () => WIZ_SIZES, selected: d => d.size, pick: (d, id) => { d.size = id; },
    preview: (o, d) => wizThumb({ ...d, size: o.id }, WIZ_MONTH) },
  { title: 'Como cada mês aparece?', desc: 'Onde a foto entra na página — dá para enquadrar cada foto direto na folha depois.',
    options: () => Object.keys(MONTH_STYLES).map(id => ({ id, label: MONTH_STYLES[id].label, desc: MONTH_STYLES[id].desc })),
    selected: d => d.style, pick: (d, id) => { d.style = id; },
    preview: (o, d) => wizThumb({ ...d, style: o.id }, WIZ_MONTH) },
  { title: 'Como vai ser a capa?', desc: 'Escreva o nome (família, empresa, pessoa) e escolha o estilo. Na folha você move, aumenta e troca a fonte de cada texto.',
    cover: true },
  { title: 'Qual paleta de cor?', desc: 'Cores da capa, dos nomes dos meses e dos fins de semana.',
    options: () => Object.keys(PALETTES).map(id => ({ id, label: PALETTES[id].label })),
    selected: d => d.palette, pick: (d, id) => { d.palette = id; },
    preview: (o, d) => wizThumb({ ...d, palette: o.id }, d.showCover ? WIZ_COVER : WIZ_MONTH, d.showCover ? WIZ_MONTH : null) },
  { title: 'Datas e feriados', desc: 'Ano, mês de início e quais datas aparecem marcadas.', dates: true },
  { title: 'Vai encadernar como?', desc: 'Reserva a margem certa e mostra onde ficam os furos.',
    options: () => Object.keys(BINDING_TYPES).map(id => ({ id, label: BINDING_TYPES[id].label })),
    selected: d => d.binding, pick: (d, id) => { d.binding = id; },
    preview: (o, d) => wizThumb({ ...d, binding: o.id }, WIZ_MONTH) },
  { title: 'Tudo pronto', desc: 'Confira e crie o calendário. Depois é só colocar as fotos.', summary: true },
];

function enterOnboarding() {
  document.body.classList.add('onboarding');
  $('#onboard').hidden = false;
  wizStep = 0; wizDraft = wizDefaultDraft();
  showTemplatesPane();
}
function exitOnboarding() {
  if (state) state.onboarded = true;
  save();
  $('#onboard').hidden = true;
  document.body.classList.remove('onboarding');
}
function showTemplatesPane() {
  $('#ob_wizard').hidden = true;
  $('#ob_templates').hidden = false;
}
function showWizardPane() {
  wizStep = 0; wizDraft = wizDraft || wizDefaultDraft();
  $('#ob_templates').hidden = true;
  $('#ob_wizard').hidden = false;
  renderWizStep();
}
function wizGo(delta) {
  const n = wizStep + delta;
  if (n < 0) { showTemplatesPane(); return; }
  if (n >= WIZ_STEPS.length) { finishWizard(); return; }
  wizStep = n; renderWizStep();
  const sc = $('#onboard'); if (sc) sc.scrollTop = 0;
}

function renderWizStep() {
  const step = WIZ_STEPS[wizStep], d = wizDraft;
  $('#ob_wizStep').innerHTML = `Passo ${wizStep + 1} de ${WIZ_STEPS.length}<span class="wiz-dots">${WIZ_STEPS.map((_, i) => `<i class="${i <= wizStep ? 'on' : ''}"></i>`).join('')}</span>`;
  $('#ob_wizTitle').textContent = step.title;
  $('#ob_wizDesc').textContent = step.desc || '';
  const grid = $('#ob_wizGrid'); grid.innerHTML = ''; grid.className = 'tpl-list';
  if (step.options) {
    step.options().forEach(opt => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'tpl-card' + (step.selected(d) === opt.id ? ' on' : '');
      b.innerHTML = `<span class="tpl-card__thumb">${step.preview(opt, d)}</span>
        <span class="tpl-card__name">${esc(opt.label)}</span>${opt.desc ? `<span class="tpl-card__desc">${esc(opt.desc)}</span>` : ''}`;
      b.onclick = () => {
        const again = step.selected(d) === opt.id;
        step.pick(d, opt.id);
        if (again) { wizGo(1); return; }
        grid.querySelectorAll('.tpl-card').forEach(c => c.classList.remove('on')); b.classList.add('on');
      };
      grid.appendChild(b);
    });
  } else if (step.cover) wizCover(grid);
  else if (step.dates) wizDates(grid);
  else wizSummary(grid);
  wizLayout(grid);
  const foot = document.createElement('div'); foot.className = 'wiz-foot';
  foot.innerHTML = `<button type="button" class="ghost" data-w="back">Voltar</button><span class="grow"></span>` +
    `<button type="button" class="primary" data-w="next">${wizStep === WIZ_STEPS.length - 1 ? 'Criar calendário' : 'Continuar'}</button>`;
  foot.querySelector('[data-w="back"]').onclick = () => wizGo(-1);
  foot.querySelector('[data-w="next"]').onclick = () => wizGo(1);
  grid.parentNode.querySelectorAll('.wiz-foot').forEach(f => f.remove());
  grid.after(foot);
}
const wizLayout = host => host.querySelectorAll('.tt').forEach(t => layoutPairThumb(t));

function wizCover(grid) {
  const d = wizDraft;
  grid.className = 'wiz-cover';
  const form = document.createElement('div'); form.className = 'wiz-coverForm';
  form.innerHTML = `<label>Nome na capa<input type="text" maxlength="60" data-k="owner" placeholder="ex.: Família Silva" value="${esc(d.owner)}"></label>
    <label>Título<input type="text" maxlength="60" data-k="title" placeholder="Calendário" value="${esc(d.title)}"></label>
    <label class="row"><input type="checkbox" data-k="showCover"${d.showCover ? ' checked' : ''}> Incluir capa</label>
    <div class="wiz-bigprev" id="wiz_bigprev"></div>`;
  const gal = document.createElement('div'); gal.className = 'wiz-coverGal';
  grid.append(form, gal);
  const big = () => { $('#wiz_bigprev').innerHTML = wizThumb(d, d.showCover ? WIZ_COVER : WIZ_MONTH); wizLayout($('#wiz_bigprev')); };
  const paint = () => {
    gal.hidden = !d.showCover;
    gal.innerHTML = Object.entries(COVER_STYLES_CAL).map(([k, label]) => `<button type="button" class="tpl-card tpl-card--cover${d.coverStyle === k ? ' on' : ''}" data-st="${k}"><span class="tpl-card__thumb">${wizThumb({ ...d, coverStyle: k }, WIZ_COVER)}</span><span class="tpl-card__name">${esc(label.replace(/\s*\(.*\)$/, ''))}</span></button>`).join('');
    wizLayout(gal); big();
  };
  gal.addEventListener('click', e => {
    const b = e.target.closest('[data-st]'); if (!b) return;
    d.coverStyle = b.dataset.st; gal.querySelectorAll('.tpl-card').forEach(c => c.classList.toggle('on', c === b)); big();
  });
  let t;
  form.addEventListener('input', e => {
    const k = e.target.dataset.k; if (!k) return;
    d[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    clearTimeout(t); t = setTimeout(paint, e.target.type === 'checkbox' ? 0 : 260);
  });
  if (!EPArt.get('enfeites/ramo')) { gal.innerHTML = '<p class="hint">Carregando estilos…</p>'; EPArt.load('enfeites').then(paint); } else paint();
}

function wizDates(grid) {
  const d = wizDraft;
  grid.className = 'wiz-look';
  const yNow = new Date().getFullYear();
  grid.innerHTML = `<div class="wiz-lookL">
      <div class="two"><label>Ano<select data-k="year">${[yNow, yNow + 1, yNow + 2].map(y => `<option${(d.year || DEFAULTS.year) === y ? ' selected' : ''}>${y}</option>`).join('')}</select></label>
      <label>Começa em<select data-k="startMonth">${EPDates.MONTHS_PT.map((m, i) => `<option value="${i + 1}"${d.startMonth === i + 1 ? ' selected' : ''}>${m}</option>`).join('')}</select></label></div>
      <label>Semana começa<select data-k="weekStart"><option value="mon"${d.weekStart === 'mon' ? ' selected' : ''}>Segunda-feira</option><option value="sun"${d.weekStart === 'sun' ? ' selected' : ''}>Domingo</option></select></label>
      <label>Feriados do estado<select data-k="uf"><option value="">Só os nacionais</option>${EPDates.UFS.map(u => `<option${d.uf === u ? ' selected' : ''}>${u}</option>`).join('')}</select></label>
      <label class="row"><input type="checkbox" data-k="holComemorativa"${d.holComemorativa ? ' checked' : ''}> Datas comemorativas (Dia das Mães, dos Pais…)</label>
    </div><div class="wiz-bigprev" id="wiz_dateprev"></div>`;
  const prev = () => { $('#wiz_dateprev').innerHTML = wizThumb(d, { kind: 'month', m: d.startMonth || 1 }); wizLayout($('#wiz_dateprev')); };
  grid.addEventListener('change', e => {
    const el = e.target, k = el.dataset.k; if (!k) return;
    d[k] = el.type === 'checkbox' ? el.checked : (k === 'year' || k === 'startMonth') ? +el.value : el.value;
    prev();
  });
  prev();
}

function wizSummary(grid) {
  const d = wizDraft;
  grid.className = 'wiz-look';
  const rows = [
    ['Tamanho', (WIZ_SIZES.find(s => s.id === d.size) || {}).label || d.size],
    ['Meses', (MONTH_STYLES[d.style] || {}).label || d.style],
    ['Capa', d.showCover ? `${COVER_STYLES_CAL[d.coverStyle] || ''}${d.owner ? ' · ' + d.owner : ''}` : 'sem capa'],
    ['Cores', (PALETTES[d.palette] || {}).label || ''],
    ['Datas', `${d.year || DEFAULTS.year}${d.startMonth > 1 ? ' a partir de ' + EPDates.MONTHS_PT[d.startMonth - 1].toLowerCase() : ''} · feriados ${d.uf ? 'nacionais + ' + d.uf : 'nacionais'}${d.holComemorativa ? ' · comemorativas' : ''}`],
    ['Encadernação', (BINDING_TYPES[d.binding] || {}).label || ''],
  ];
  grid.innerHTML = `<div class="wiz-lookL"><dl class="wiz-sum">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <p class="hint">No calendário, toque numa página para colocar a foto, adicionar texto ou ilustração (ex.: uma árvore em dezembro).</p></div>
    <div class="wiz-bigprev">${wizThumb(d, d.showCover ? WIZ_COVER : WIZ_MONTH, d.showCover ? WIZ_MONTH : null)}</div>`;
}

function finishWizard() {
  const d = wizDraft;
  pushHistory();
  applyTemplate({ settings: { ...d, showPunch: !!(BINDING_TYPES[d.binding] || {}).edge } });
  syncDocControls(); render(); save();
  if (!userZoomed) fit();
  toast('Calendário pronto — toque numa página para colocar a foto.');
  exitOnboarding();
}

(function initWizard() {
  $('#ob_wizStart').onclick = showWizardPane;
  $('#ob_wizBack').onclick = () => wizGo(-1);
  if (state && !state.onboarded) enterOnboarding();
})();
