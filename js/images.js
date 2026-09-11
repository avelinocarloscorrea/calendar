/* Calendar Studio — js/images.js
   Importar foto (100% local) + abrir o editor (packages/core/imgedit.js) pra
   recortar/ajustar antes de entrar no calendário. O arquivo é redesenhado
   num <canvas> assim que escolhido — isso já remove EXIF/GPS antes mesmo de
   abrir o editor. (parte de app; carregado em ordem por index.html) */
"use strict";

const IMG_SRC_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
function validImageSrc(v) {
  return typeof v === 'string' && v.length < 6e6 && IMG_SRC_RE.test(v);
}

// lê o arquivo escolhido, redesenha (tira EXIF/GPS, reduz a ~1800px) e
// devolve uma Promise<dataURL> — a fonte que entra no editor e fica salva
// pra permitir reenquadrar depois sem perder qualidade de novo.
function readAndSanitize(file) {
  return new Promise((resolve, reject) => {
    if (file.size > 20 * 1024 * 1024) { reject(new Error('Imagem muito grande (máx. 20 MB).')); return; }
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Não consegui ler o arquivo.'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo de imagem inválido.'));
      img.onload = () => {
        let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (!w || !h) { reject(new Error('Imagem sem dimensões.')); return; }
        const scale = Math.min(1, 1800 / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        let out;
        try { out = cv.toDataURL('image/jpeg', 0.88); }
        catch (e) { reject(new Error('Não consegui processar a imagem.')); return; }
        if (out.length > 5.5e6) { try { out = cv.toDataURL('image/jpeg', 0.7); } catch (e) {} }
        if (out.length > 6e6) { reject(new Error('Imagem grande demais mesmo otimizada — use uma menor.')); return; }
        if (!validImageSrc(out)) { reject(new Error('Não consegui validar a imagem processada.')); return; }
        resolve(out);
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

function openEditorFor(src, aspect, edit, title, done) {
  if (typeof EPImgEdit === 'undefined') { toast('Editor de imagem indisponível.'); return; }
  EPImgEdit.open({
    src, aspect, edit, title: title || 'Ajustar foto', outMax: 1800, applyLabel: 'Aplicar',
    onApply: res => { done(res); toast('Foto ajustada — fica só neste aparelho.'); },
  });
}

// escolher um arquivo novo → sanitizar → abrir o editor → cb({photo, photoSrc, photoEdit})
function pickAndEdit(opts) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/png,image/jpeg,image/webp,image/gif';
  inp.onchange = () => {
    const file = inp.files && inp.files[0]; if (!file) return;
    readAndSanitize(file).then(src => {
      openEditorFor(src, opts.aspect, null, opts.title, res => {
        opts.cb({ photo: res.dataURL, photoSrc: src, photoEdit: res.edit });
      });
    }).catch(err => toast(err.message || 'Não consegui processar a imagem.'));
  };
  inp.click();
}
// reabrir o editor numa foto já existente (photoSrc + photoEdit salvos)
function reframe(opts) {
  openEditorFor(opts.src, opts.aspect, opts.edit, opts.title, res => {
    opts.cb({ photo: res.dataURL, photoSrc: opts.src, photoEdit: res.edit });
  });
}
