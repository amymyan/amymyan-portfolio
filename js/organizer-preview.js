/* Organizer-only image previews — smaller JPEGs from local files or R2 */

const ORGANIZER_THUMB_LIBRARY = 160;
const ORGANIZER_THUMB_FRAME = 320;
const ORGANIZER_THUMB_POLAROID = 420;
const ORGANIZER_THUMB_PORTRAIT = 280;
const SITE_PREVIEW_MAX_PX = 960;
const SITE_PREVIEW_QUALITY = 0.8;

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

async function resizeToJpegBlob(img, maxPx, quality = 0.72) {
  const maxDim = Math.max(img.naturalWidth, img.naturalHeight) || 1;
  const scale = Math.min(1, maxPx / maxDim);
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.drawImage(img, 0, 0, w, h);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('canvas blob failed');
  return URL.createObjectURL(blob);
}

async function writeSitePreviewFromFile(src, file) {
  if (!src || !file || typeof getDir !== 'function') return false;
  if (typeof isVideoPath === 'function' && isVideoPath(src)) return false;
  const parsed = parseAssetPath(src);
  if (!parsed) return false;
  if (!/\.(jpe?g|png|webp|gif)$/i.test(parsed.filename)) return false;

  const objectUrl = URL.createObjectURL(file);
  let previewUrl = '';
  try {
    const img = await loadImageElement(objectUrl);
    previewUrl = await resizeToJpegBlob(img, SITE_PREVIEW_MAX_PX, SITE_PREVIEW_QUALITY);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  const blob = await fetch(previewUrl).then(r => r.blob());
  URL.revokeObjectURL(previewUrl);

  const dir = await getDir('assets/previews/' + parsed.page, { create: true });
  const outHandle = await dir.getFileHandle(parsed.filename, { create: true });
  const writable = await outHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  return true;
}

async function sitePreviewExists(src) {
  const parsed = parseAssetPath(src);
  if (!parsed || typeof getDir !== 'function' || !rootHandle) return false;
  try {
    const dir = await getDir('assets/previews/' + parsed.page);
    await dir.getFileHandle(parsed.filename);
    return true;
  } catch {
    return false;
  }
}

async function fileFromRemoteSrc(src, filename) {
  const res = await fetch(mediaSrc(src));
  if (!res.ok) return null;
  const blob = await res.blob();
  if (!blob?.size) return null;
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}

async function ensureSitePreview(src) {
  if (!src || typeof rootHandle === 'undefined' || !rootHandle) return false;
  const parsed = parseAssetPath(src);
  if (!parsed) return false;
  if (typeof isVideoPath === 'function' && isVideoPath(src)) return false;
  if (!/\.(jpe?g|png|webp|gif)$/i.test(parsed.filename)) return false;
  if (await sitePreviewExists(src)) return true;

  let file = null;
  try {
    const dir = await getDir('assets/' + parsed.page);
    file = await (await dir.getFileHandle(parsed.filename)).getFile();
  } catch {
    try {
      file = await fileFromRemoteSrc(src, parsed.filename);
    } catch {
      file = null;
    }
  }
  if (!file) return false;
  return writeSitePreviewFromFile(src, file);
}

async function ensureSitePreviews(srcs) {
  const list = [...new Set((srcs || []).filter(Boolean))];
  const limit = 2;
  for (let i = 0; i < list.length; i += limit) {
    await Promise.all(list.slice(i, i + limit).map(src => ensureSitePreview(src).catch(() => false)));
  }
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

function organizerFastSrc(src) {
  const preview = typeof mediaPreviewSrc === 'function' ? mediaPreviewSrc(src) : null;
  return preview || mediaSrc(src);
}

const organizerLazyObservers = new WeakMap();
const ORGANIZER_LAZY_CONCURRENCY = 4;
let organizerLazyInFlight = 0;
const organizerLazyQueue = [];

function pumpOrganizerLazyQueue() {
  while (organizerLazyInFlight < ORGANIZER_LAZY_CONCURRENCY && organizerLazyQueue.length) {
    const img = organizerLazyQueue.shift();
    const url = img?.dataset?.lazySrc;
    if (!img?.isConnected || !url) continue;
    organizerLazyInFlight++;
    const done = () => {
      organizerLazyInFlight--;
      pumpOrganizerLazyQueue();
    };
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
    delete img.dataset.lazySrc;
    img.src = url;
  }
}

function observeOrganizerLazyImg(img, root) {
  const key = root || document.documentElement;
  let observer = organizerLazyObservers.get(key);
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        organizerLazyQueue.push(entry.target);
        pumpOrganizerLazyQueue();
      });
    }, { root: root || null, rootMargin: '240px', threshold: 0.01 });
    organizerLazyObservers.set(key, observer);
  }
  observer.observe(img);
}

function markOrganizerImgReady(img) {
  img.classList.add('is-ready');
}

function attachOrganizerPreviewFallback(img, src, onBroken) {
  img.addEventListener('load', () => markOrganizerImgReady(img));
  img.addEventListener('error', () => {
    if (img.dataset.previewSrc !== src) return;
    const preview = typeof mediaPreviewSrc === 'function' ? mediaPreviewSrc(src) : null;
    const full = mediaSrc(src);
    if (preview && img.dataset.previewFallback !== '1') {
      img.dataset.previewFallback = '1';
      img.src = full;
      return;
    }
    if (typeof onBroken === 'function') onBroken();
  });
  if (img.complete && img.naturalWidth) markOrganizerImgReady(img);
}

function setOrganizerLazyImg(img, src, { root = null, onBroken = null } = {}) {
  if (!src || !img) return;
  img.dataset.previewSrc = src;
  img.decoding = 'async';
  attachOrganizerPreviewFallback(img, src, onBroken);

  const url = organizerFastSrc(src);
  if (!('IntersectionObserver' in window)) {
    img.src = url;
    return;
  }
  img.dataset.lazySrc = url;
  observeOrganizerLazyImg(img, root);
}

function setOrganizerPreviewImg(img, src, maxPx) {
  if (!src || !img) return;
  img.dataset.previewSrc = src;
  img.decoding = 'async';
  img.loading = 'lazy';

  const preview = typeof mediaPreviewSrc === 'function' ? mediaPreviewSrc(src) : null;
  const full = mediaSrc(src);
  img.src = preview || full;
  attachOrganizerPreviewFallback(img, src);
}

function clearOrganizerPreviewCache() {
  organizerThumbCache.clear();
  organizerLocalUrlCache.forEach(url => {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
  });
  organizerLocalUrlCache.clear();
}
