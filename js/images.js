/* Calendar Studio — js/images.js
   Importar/sanitizar foto — 100% local. Reprocessa via <canvas>: reduz para
   no máx. ~1600 px de lado maior e RE-CODIFICA, o que REMOVE todos os
   metadados (EXIF/GPS). Nada é enviado a servidor nenhum. Mesmo padrão do
   campo de imagem do Planner Studio (logo/fundo da capa).
   (parte de app; carregado em ordem por index.html) */
"use strict";

const IMG_SRC_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;
function validImageSrc(v) {
  return typeof v === 'string' && v.length < 6e6 && IMG_SRC_RE.test(v);
}

function pickImage(cb) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/png,image/jpeg,image/webp,image/gif';
  inp.onchange = () => {
    const file = inp.files && inp.files[0]; if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast('Imagem muito grande (máx. 20 MB).'); return; }
    const fr = new FileReader();
    fr.onerror = () => toast('Não consegui ler o arquivo.');
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => toast('Arquivo de imagem inválido.');
      img.onload = () => {
        let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (!w || !h) { toast('Imagem sem dimensões.'); return; }
        const scale = Math.min(1, 1600 / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        const keepAlpha = /^data:image\/(png|gif|webp)/i.test(String(fr.result));
        let out;
        try { out = keepAlpha ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.85); }
        catch (e) { toast('Não consegui processar a imagem.'); return; }
        if (out.length > 4.6e6) { try { out = cv.toDataURL('image/jpeg', 0.7); } catch (e) {} }
        if (out.length > 5e6) { toast('Imagem grande demais mesmo otimizada — use uma menor.'); return; }
        if (!validImageSrc(out)) { toast('Não consegui validar a imagem processada.'); return; }
        cb(out);
        toast('Foto adicionada — fica só neste aparelho.');
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  };
  inp.click();
}
