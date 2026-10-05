/* Full-screen loader — stays up until page media has actually loaded. */

const LOADER_STAR_OUTLINE = [
  [50, 10],
  [59.1, 37.5],
  [88, 37.6],
  [64.7, 54.8],
  [73.5, 82.4],
  [50, 65.5],
  [26.5, 82.4],
  [35.3, 54.8],
  [12, 37.6],
  [40.9, 37.5]
];
const LOADER_STAR_GLYPHS = ['✦', '✧', '★', '⋆', '✦'];

function fillStarConstellation(orbit) {
  const between = 3;
  const points = [];
  LOADER_STAR_OUTLINE.forEach((start, i) => {
    const end = LOADER_STAR_OUTLINE[(i + 1) % LOADER_STAR_OUTLINE.length];
    points.push({ x: start[0], y: start[1], tip: i % 2 === 0 });
    for (let s = 1; s <= between; s++) {
      const t = s / (between + 1);
      points.push({
        x: start[0] + (end[0] - start[0]) * t,
        y: start[1] + (end[1] - start[1]) * t,
        tip: false
      });
    }
  });

  orbit.replaceChildren();
  points.forEach((point, i) => {
    const wrap = document.createElement('span');
    wrap.className = 'page-loader-orbit-dot' + (point.tip ? ' is-tip' : '');
    wrap.style.setProperty('--x', point.x.toFixed(2) + '%');
    wrap.style.setProperty('--y', point.y.toFixed(2) + '%');
    wrap.style.setProperty('--d', (i * 0.06) + 's');
    const glyph = document.createElement('span');
    glyph.textContent = LOADER_STAR_GLYPHS[i % LOADER_STAR_GLYPHS.length];
    wrap.appendChild(glyph);
    orbit.appendChild(wrap);
  });
}

(function initPageLoader() {
  const loader = document.getElementById('page-loader');
  if (!loader) return;

  const orbit = loader.querySelector('.page-loader-orbit');
  if (orbit) fillStarConstellation(orbit);

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MIN_MS = reduceMotion ? 0 : 700;
  const HARD_MAX_MS = 20000;
  const started = performance.now();
  const root = document.querySelector('main, .about-wrap') || document.body;

  let finished = false;
  let emptyPage = false;

  function dismiss() {
    if (finished) return;
    finished = true;
    const wait = Math.max(0, MIN_MS - (performance.now() - started));
    window.setTimeout(() => {
      document.body.classList.add('is-ready');
      document.body.classList.remove('is-booting');
      loader.classList.add('is-done');
      loader.setAttribute('aria-hidden', 'true');
      window.setTimeout(() => loader.remove(), 1100);
    }, wait);
  }

  window.amyMarkPageReady = function (info) {
    if (info && info.empty) emptyPage = true;
  };

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function isMediaReady(el) {
    if (el.tagName === 'VIDEO') return el.readyState >= 2 || Boolean(el.error);
    return el.complete;
  }

  function shouldWaitFor(el) {
    if (!el || el.closest('#page-loader')) return false;
    if (el.closest('.lightbox-overlay, .hover-preview')) return false;
    if (el.closest('.home-film-strip, .home-cover-grid, .contact-sheet-board, .video-grid, .about-wrap')) {
      return true;
    }
    const src = el.currentSrc || el.getAttribute('src') || el.src;
    if (!src) return false;
    const rect = el.getBoundingClientRect();
    if (!rect.width && !rect.height) return el.loading !== 'lazy';
    return rect.top < window.innerHeight * 1.35;
  }

  function collectTargets() {
    return [...root.querySelectorAll('img, video')].filter(shouldWaitFor);
  }

  function waitForElement(el) {
    if (el.tagName === 'IMG' && el.loading === 'lazy') el.loading = 'eager';
    if (isMediaReady(el)) {
      if (el.tagName === 'IMG' && el.naturalWidth > 0 && el.decode) {
        return el.decode().catch(() => {});
      }
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const done = () => {
        if (el.tagName === 'IMG' && el.decode) el.decode().then(resolve).catch(resolve);
        else resolve();
      };
      el.addEventListener('load', done, { once: true });
      el.addEventListener('loadeddata', done, { once: true });
      el.addEventListener('error', resolve, { once: true });
    });
  }

  async function waitForPageMedia() {
    const deadline = started + HARD_MAX_MS;
    let lastCount = -1;
    let stablePasses = 0;

    while (performance.now() < deadline) {
      if (emptyPage) return;
      const targets = collectTargets();
      if (!targets.length) {
        await sleep(80);
        continue;
      }

      await Promise.all(targets.map(waitForElement));
      await sleep(180);

      const next = collectTargets();
      if (next.length === lastCount && next.length === targets.length && next.every(isMediaReady)) {
        stablePasses += 1;
        if (stablePasses >= 3) return;
      } else {
        stablePasses = 0;
      }
      lastCount = next.length;
    }
  }

  waitForPageMedia().then(dismiss).catch(dismiss);
})();
