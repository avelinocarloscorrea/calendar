/* Planner Studio — js/install.js
   Instalar na tela de início (PWA). Sem service worker: captura o
   beforeinstallprompt e mostra o item no menu; iOS cai num aviso. */
"use strict";

let _deferredInstall = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); _deferredInstall = e; const b = $('#m_install'); if (b) b.hidden = false; });
addEventListener('appinstalled', () => { _deferredInstall = null; const b = $('#m_install'); if (b) b.hidden = true; try { toast('App instalado.'); } catch (_) {} });
function _isStandalone() { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
function _isIOS() { return /iP(hone|ad|od)/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent); }
function doInstall() {
  if (_deferredInstall) { _deferredInstall.prompt(); _deferredInstall.userChoice.finally(() => { _deferredInstall = null; }); return; }
  if (_isIOS()) alert('Para instalar no iPhone/iPad:\n\n1. Toque em Compartilhar.\n2. Escolha “Adicionar à Tela de Início”.');
}
function initInstall() {
  const b = $('#m_install'); if (!b) return;
  b.onclick = () => { $('#menu').hidden = true; doInstall(); };
  if (_isIOS() && !_isStandalone()) b.hidden = false;
}
