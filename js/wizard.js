/* Calendar Studio — js/wizard.js
   Tela inicial sem menus: modelos prontos OU montar do zero em 4 passos
   curtos (tamanho → estilo do mês → paleta → encadernação). Cada opção já
   mostra a miniatura real (tplThumbSVG, de ui.js) com as escolhas
   acumuladas até ali — ao chegar no editor o calendário já está quase
   pronto, só falta fotos e legendas.
   (parte de app; carregado depois de ui.js — usa tplThumbSVG/esc/$ dela) */
"use strict";

const WIZ_STEPS = [
  { title: 'Que tamanho de calendário?', desc: 'Define o formato e como ele vai ser pendurado ou apoiado.',
    options: [
      { id: 'a4p', label: 'Parede A4', desc: 'retrato · 210×297mm' },
      { id: 'a3p', label: 'Pôster A3', desc: 'retrato · bem grande' },
      { id: 'a4l', label: 'Parede A4 deitado', desc: 'paisagem · 297×210mm' },
      { id: 'square', label: 'Quadrado', desc: '210×210mm · pra redes sociais' },
      { id: 'a6l', label: 'Mesa A6', desc: 'paisagem · cabe numa escrivaninha' },
      { id: 'magnet', label: 'Ímã de geladeira', desc: 'bem pequeno · 100×140mm' },
      { id: 'standee', label: 'Cavalete de mesa', desc: 'dobra ao meio, fica de pé sozinho' },
    ].map(o => ({ ...o, settings: { size: o.id } })) },
  { title: 'Como cada mês aparece?', desc: 'Onde a foto entra na página.',
    options: Object.keys(MONTH_STYLES).map(id => ({ id, label: MONTH_STYLES[id].label, desc: MONTH_STYLES[id].desc, settings: { style: id } })) },
  { title: 'Qual paleta de cor?', desc: '',
    options: Object.keys(PALETTES).map(id => ({ id, label: PALETTES[id].label, desc: '', settings: { palette: id } })) },
  { title: 'Vai encadernar como?', desc: 'Reserva a margem certa e mostra o furo na página.',
    options: Object.keys(BINDING_TYPES).map(id => ({ id, label: BINDING_TYPES[id].label, desc: '', settings: { binding: id, showPunch: !!BINDING_TYPES[id].edge } })) },
];

let wizStep = 0;
let wizDraft = null;
const wizDefaultDraft = () => ({ size: 'a4p', style: 'sografe', palette: 'esmeralda', binding: 'none', showCover: true });

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
  $('#ob_templates').hidden = true;
  $('#ob_wizard').hidden = false;
  renderWizStep();
}
function renderWizStep() {
  const step = WIZ_STEPS[wizStep];
  $('#ob_wizStep').textContent = `Passo ${wizStep + 1} de ${WIZ_STEPS.length}`;
  $('#ob_wizTitle').textContent = step.title;
  $('#ob_wizDesc').textContent = step.desc || '';
  const grid = $('#ob_wizGrid'); grid.innerHTML = '';
  step.options.forEach(opt => {
    const preview = { id: 'wiz-' + opt.id, settings: { ...wizDraft, ...opt.settings } };
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tpl-card';
    b.innerHTML = `<span class="tpl-card__thumb">${tplThumbSVG(preview)}</span>
      <span class="tpl-card__name">${esc(opt.label)}</span>
      <span class="tpl-card__desc">${esc(opt.desc || '')}</span>`;
    b.onclick = () => {
      Object.assign(wizDraft, opt.settings);
      if (wizStep < WIZ_STEPS.length - 1) { wizStep++; renderWizStep(); }
      else finishWizard();
    };
    grid.appendChild(b);
  });
}
function finishWizard() {
  pushHistory();
  applyTemplate({ settings: wizDraft });
  syncDocControls(); render(); save();
  if (!userZoomed) fit();
  toast('Calendário pronto — é só ajustar fotos e legendas.');
  exitOnboarding();
}

(function initWizard() {
  $('#ob_wizStart').onclick = showWizardPane;
  $('#ob_wizBack').onclick = () => { if (wizStep > 0) { wizStep--; renderWizStep(); } else showTemplatesPane(); };
  if (state && !state.onboarded) enterOnboarding();
})();
