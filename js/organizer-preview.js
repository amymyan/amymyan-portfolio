/* Organizer-only image previews — smaller JPEGs from local files or R2 */

const ORGANIZER_THUMB_LIBRARY = 160;
const ORGANIZER_THUMB_FRAME = 320;
const ORGANIZER_THUMB_POLAROID = 420;
const ORGANIZER_THUMB_PORTRAIT = 280;

const organizerThumbCache = new Map();
const organizerLocalUrlCache = new Map();

function organizerThumbKey(src, maxPx) {
  return src + '|' + maxPx;
}

function parseAssetPath(src) {
  const m = (src || '').match(/^assets\/([^/]+)\/(.+)$/);
  if (!m) return null;
  return { page: m[1], filename: decodeURIComponent(m[2]) };
}

async function resolveOrganizerLoadUrl(src) {
  const localKey = 'local:' + src;
  if (organizerLocalUrlCache.has(localKey)) return organizerLocalUrlCache.get(localKey);

  const parsed = parseAssetPath(src);
  if (parsed && typeof rootHandle !== 'undefined' && rootHandle) {
    try {
      const dir = await getDir('assets/' + parsed.page);
      const file = await (await dir.getFileHandle(parsed.filename)).getFile();
      const url = URL.createObjectURL(file);
      organizerLocalUrlCache.set(localKey, url);
      return url;
    } catch { /* fall through to remote */ }
  }

  return mediaSrc(src);
}

function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    /* Do not set crossOrigin — R2 often lacks CORS headers and the image
       would fail to load at all. Canvas resize only works for blob: URLs. */
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = url;
  });
}

async function resizeToJpegBlob(img, maxPx) {
  const maxDim = Math.max(img.naturalWidth, img.naturalHeight) || 1;
  const scale = Math.min(1, maxPx / maxDim);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.72));
  if (!blob) throw new Error('canvas blob failed');
  return URL.createObjectURL(blob);
}

async function createOrganizerThumbUrl(src, maxPx) {
  const key = organizerThumbKey(src, maxPx);
  if (organizerThumbCache.has(key)) return organizerThumbCache.get(key);

  const task = (async () => {
    const loadUrl = await resolveOrganizerLoadUrl(src);

    try {
      const img = await loadImageElement(loadUrl);
      const maxDim = Math.max(img.naturalWidth, img.naturalHeight) || 1;
      const canResize = loadUrl.startsWith('blob:');

      if (canResize && maxDim > maxPx) {
        try {
          return await resizeToJpegBlob(img, maxPx);
        } catch { /* use direct url below */ }
      }

      return loadUrl;
    } catch {
      return mediaSrc(src);
    }
  })();

  organizerThumbCache.set(key, task);
  return task;
}

function setOrganizerPreviewImg(img, src, maxPx) {
  if (!src || !img) return;
  img.dataset.previewSrc = src;
  img.decoding = 'async';
  img.loading = 'lazy';
  img.src = mediaSrc(src);

  createOrganizerThumbUrl(src, maxPx).then(url => {
    if (img.dataset.previewSrc === src && url) img.src = url;
  }).catch(() => {
    if (img.dataset.previewSrc === src) img.src = mediaSrc(src);
  });
}

function clearOrganizerPreviewCache() {
  organizerThumbCache.clear();
  organizerLocalUrlCache.forEach(url => {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  });
  organizerLocalUrlCache.clear();
}
