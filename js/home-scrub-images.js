/* Low-res scrub thumbnails for homepage filmstrip */

const HomeScrubImages = (function initHomeScrubImages() {
  const SCRUB_MAX_WIDTH = 280;
  const SCRUB_QUALITY = 0.52;
  const CONCURRENCY = 6;

  const cache = new Map();
  const pending = new Map();
  const queued = new Set();
  const jobQueue = [];
  let active = 0;

  function loadImage(url, crossOrigin) {
    return new Promise((resolve) => {
      const img = new Image();
      if (crossOrigin) img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async function buildCanvasThumb(path) {
    const img = await loadImage(mediaSrc(path), true);
    if (!img) return null;

    try {
      const scale = Math.min(1, SCRUB_MAX_WIDTH / img.naturalWidth);
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', SCRUB_QUALITY);
      });
      if (!blob) return null;
      const url = URL.createObjectURL(blob);
      cache.set(path, url);
      return url;
    } catch {
      return null;
    }
  }

  async function resolveScrubUrl(path) {
    if (!path) return null;
    if (cache.has(path)) return cache.get(path);

    const cdn = mediaSrcScrub(path);
    if (cdn) {
      cache.set(path, cdn);
      return cdn;
    }

    if (pending.has(path)) return pending.get(path);

    const job = (async () => {
      const thumb = await buildCanvasThumb(path);
      if (thumb) return thumb;
      /* CORS blocked canvas — still defer full image, don't block boot */
      const fallback = mediaSrc(path);
      cache.set(path, fallback);
      return fallback;
    })();

    pending.set(path, job);
    try {
      return await job;
    } finally {
      pending.delete(path);
    }
  }

  function applyToImages(path, url) {
    if (!url) return;
    document.querySelectorAll('img[data-scrub-src]').forEach((img) => {
      if (img.dataset.scrubSrc !== path) return;
      img.src = url;
      img.removeAttribute('data-scrub-src');
    });
  }

  function finishJob(path) {
    queued.delete(path);
  }

  function drainQueue() {
    while (active < CONCURRENCY && jobQueue.length) {
      const item = jobQueue.shift();
      if (!item) continue;
      if (cache.has(item.path)) {
        applyToImages(item.path, cache.get(item.path));
        finishJob(item.path);
        continue;
      }
      if (pending.has(item.path)) {
        jobQueue.push(item);
        break;
      }
      active++;
      resolveScrubUrl(item.path)
        .then((url) => applyToImages(item.path, url))
        .finally(() => {
          finishJob(item.path);
          active--;
          drainQueue();
        });
    }
  }

  function queue(path, { priority = false } = {}) {
    if (!path || cache.has(path) || queued.has(path)) return;
    queued.add(path);
    if (priority) jobQueue.unshift({ path });
    else jobQueue.push({ path });
    drainQueue();
  }

  function queueMany(paths, options) {
    paths.forEach((path) => queue(path, options));
  }

  function resolveMany(paths) {
    const unique = [...new Set((paths || []).filter(Boolean))];
    unique.forEach((path) => queue(path, { priority: true }));
    return Promise.all(unique.map((path) => resolveScrubUrl(path)));
  }

  async function preloadCovers(coverPaths, { timeoutMs = 8000 } = {}) {
    const unique = [...new Set(coverPaths.filter(Boolean))];
    await Promise.all(unique.map((path) => {
      return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(finish, timeoutMs);
        const img = new Image();
        img.onload = () => {
          if (img.decode) img.decode().then(finish).catch(finish);
          else finish();
        };
        img.onerror = finish;
        img.src = mediaSrc(path);
      });
    }));
  }

  return { queue, queueMany, resolveMany, resolveScrubUrl, preloadCovers, cache };
})();
