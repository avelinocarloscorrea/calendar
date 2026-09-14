/* Calendar Studio — js/images.js
   Importar foto (100% local). O arquivo é redesenhado num <canvas> assim
   que escolhido — isso já remove EXIF/GPS antes mesmo de entrar no editor
   (packages/core/imgedit.js), que fica embutido no painel direito (ver
   renderImageField em ui.js) — sem popup, arrastar/zoom/filtros ao vivo.
   (parte de app; carregado em ordem por index.html) */
"use strict";

const IMG_SRC_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
function validImageSrc(v) {
  return typeof v === 'string' && v.length < 16e6 && IMG_SRC_RE.test(v);
}

// lê o arquivo escolhido, redesenha (tira EXIF/GPS, reduz a no máx. 3600 px, o bastante para A4 a 300 dpi) e
// devolve uma Promise<dataURL> — a fonte que o editor usa, guardada em
// `photoSrc` pra poder reajustar depois sem perder qualidade de novo.
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
        const scale = Math.min(1, 3600 / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        let out;
        try { out = cv.toDataURL('image/jpeg', 0.9); }
        catch (e) { reject(new Error('Não consegui processar a imagem.')); return; }
        if (out.length > 9e6) { try { out = cv.toDataURL('image/jpeg', 0.78); } catch (e) {} }
        if (out.length > 15e6) { reject(new Error('Imagem grande demais mesmo otimizada — use uma menor.')); return; }
        if (!validImageSrc(out)) { reject(new Error('Não consegui validar a imagem processada.')); return; }
        resolve(out);
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

// escolher um arquivo novo (ou trocar um existente) → sanitizar →
// cb({photoSrc, photoEdit}). `photo` (a versão assada) ainda não existe
// aqui — o editor embutido (EPImgEdit.mount, em ui.js) assa e chama
// onCommit assim que a imagem carrega, sem exigir gesto nenhum do usuário.
function pickNewPhoto(opts) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/png,image/jpeg,image/webp,image/gif';
  inp.onchange = () => {
    const file = inp.files && inp.files[0]; if (!file) return;
    readAndSanitize(file).then(src => {
      opts.cb({ photoSrc: src, photoEdit: opts.keepEdit || null });
    }).catch(err => toast(err.message || 'Não consegui processar a imagem.'));
  };
  inp.click();
}
