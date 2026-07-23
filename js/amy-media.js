/* Shared helpers for board.js and organizer.js */

const DEFAULT_WIDTH_PERCENT = 25;

function isVideoPath(path) {
  return /\.(mp4|webm|mov)(\?|$)/i.test(path || '');
}

function mediaSrc(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;

  const base = (window.MEDIA_BASE_URL || '').replace(/\/$/, '');
  const encoded = path.split('/').map(part => encodeURIComponent(part)).join('/');

  return base ? base + '/' + encoded.replace(/^\//, '') : encoded;
}

function imageCdnOrigin() {
  const custom = (window.IMAGE_CDN_ORIGIN || '').replace(/\/$/, '');
  if (custom) return custom;
  if (typeof window !== 'undefined' && window.location?.origin &&
      !window.location.origin.startsWith('file:')) {
    return window.location.origin;
  }
  return '';
}

/* Smaller display URLs for grids/thumbs — full mediaSrc for lightbox.
   Uses Cloudflare /cdn-cgi/image/ when DISPLAY_IMAGE_CDN_PARAMS is set. */
function mediaSrcDisplay(path) {
  const params = window.DISPLAY_IMAGE_CDN_PARAMS;
  const origin = imageCdnOrigin();
  if (!path || !params || !origin || /^https?:\/\//i.test(path)) return mediaSrc(path);
  return `${origin}/cdn-cgi/image/${params}/${mediaSrc(path)}`;
}

const _retainedUrls = new Set();
const _retainPromises = new Map();

function getMediaRetainRoot() {
  let root = document.getElementById('media-retain-cache');
  if (!root) {
    root = document.createElement('div');
    root.id = 'media-retain-cache';
    root.setAttribute('aria-hidden', 'true');
    root.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;z-index:-1';
    document.body.appendChild(root);
  }
  return root;
}

/* Keep decoded bitmaps in a hidden DOM node so scroll-back doesn't flash white. */
function retainMediaUrl(url) {
  const src = (url || '').trim();
  if (!src || _retainedUrls.has(src)) {
    return _retainPromises.get(src) || Promise.resolve();
  }
  _retainedUrls.add(src);

  const promise = new Promise((resolve) => {
    const pin = document.createElement('img');
    pin.alt = '';
    pin.loading = 'eager';
    pin.decoding = 'async';
    const finish = () => {
      if (pin.decode) pin.decode().then(resolve).catch(resolve);
      else resolve();
    };
    pin.onload = finish;
    pin.onerror = finish;
    pin.src = src;
    getMediaRetainRoot().appendChild(pin);
  });

  _retainPromises.set(src, promise);
  return promise;
}

function bindImageRetain(img) {
  if (!img || img.dataset.retainBound) return;
  img.dataset.retainBound = '1';
  const pin = () => {
    const url = img.currentSrc || img.src;
    if (url) retainMediaUrl(url);
  };
  if (img.complete && img.naturalWidth) pin();
  else img.addEventListener('load', pin, { once: true });
}

async function preloadMediaPaths(paths, { concurrency = 10, retain = true } = {}) {
  const seen = new Set();
  const urls = [];
  (paths || []).forEach(path => {
    const src = (path || '').trim();
    if (!src || seen.has(src) || isVideoPath(src)) return;
    seen.add(src);
    urls.push(mediaSrcDisplay(src));
  });

  if (!urls.length) return;

  let cursor = 0;
  async function worker() {
    while (cursor < urls.length) {
      const url = urls[cursor++];
      if (retain) await retainMediaUrl(url);
      else {
        await new Promise((resolve) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = resolve;
          img.src = url;
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, urls.length) }, () => worker())
  );
}

/* Load what's on screen first, then the rest. */
async function preloadMediaPathsNearViewport(items, rootEl, { margin = 900, concurrency = 10 } = {}) {
  const scrollY = window.scrollY;
  const viewTop = scrollY - margin;
  const viewBottom = scrollY + window.innerHeight + margin;
  const boardTop = rootEl?.offsetTop || 0;

  const seen = new Set();
  const near = [];
  const far = [];

  (items || []).forEach(item => {
    const path = typeof item === 'string' ? item : item.path;
    const y = typeof item === 'object' ? (item.y ?? 0) : 0;
    const src = (path || '').trim();
    if (!src || seen.has(src) || isVideoPath(src)) return;
    seen.add(src);
    const absY = boardTop + y;
    if (absY >= viewTop && absY <= viewBottom) near.push(src);
    else far.push(src);
  });

  await preloadMediaPaths(near, { concurrency });
  await preloadMediaPaths(far, { concurrency });
}

/* Optional CDN resize for scrub frames — set in config.js, e.g.
   window.SCRUB_IMAGE_CDN_PARAMS = 'width=480,quality=55,format=auto';
   Only works if your media host supports /cdn-cgi/image/… URLs. */
function mediaSrcScrub(path) {
  const params = window.SCRUB_IMAGE_CDN_PARAMS;
  if (!path || !params || !window.MEDIA_BASE_URL) return null;
  if (/^https?:\/\//i.test(path)) return null;

  const base = window.MEDIA_BASE_URL.replace(/\/$/, '');
  const encoded = path.split('/').map(part => encodeURIComponent(part)).join('/');
  return base + '/cdn-cgi/image/' + params + '/' + encoded.replace(/^\//, '');
}

function normalizeWidthPercent(value, referenceWidthPx = 1200) {
  if (value == null || value === '') return DEFAULT_WIDTH_PERCENT;
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_WIDTH_PERCENT;
  if (n > 100) return Math.min(95, Math.round((n / referenceWidthPx) * 100));
  return Math.max(5, Math.min(95, Math.round(n)));
}

function normalizeRotation(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function applyTileRotation(el, rotation) {
  const deg = normalizeRotation(rotation);
  el.dataset.rotation = deg;
  const media = el.querySelector('.tile-media');
  const target = media || el;
  target.style.transform = deg ? `rotate(${deg}deg)` : '';
}

function applyTileLayout(el, board, { x, y, width, rotation }) {
  const u = boardUnit(board);
  el.dataset.x = x;
  el.dataset.y = y;
  el.dataset.w = width;
  el.style.left = (x * u) + 'px';
  el.style.top = (y * u) + 'px';
  el.style.width = (width * u) + 'px';
  if (rotation != null) applyTileRotation(el, rotation);
}

function readTileCoords(el) {
  return {
    x: parseFloat(el.dataset.x),
    y: parseFloat(el.dataset.y),
    width: parseFloat(el.dataset.w),
    rotation: parseFloat(el.dataset.rotation) || 0
  };
}

function reflowBoardTiles(board, tileSelector = '.polaroid, .mini-polaroid') {
  board.querySelectorAll(tileSelector).forEach(el => {
    const { x, y, width, rotation } = readTileCoords(el);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width)) {
      applyTileLayout(el, board, { x, y, width, rotation });
    }
  });
}

/* Scale film chrome with board width; text uses fixed rem/px in CSS. */
function syncContactSheetScale(board) {
  const u = boardUnit(board);
  if (!u) return;
  board.querySelectorAll('.contact-sheet').forEach(el => {
    el.style.setProperty('--sheet-u', u + 'px');
  });
}

function reflowContactSheets(board) {
  syncContactSheetScale(board);
  reflowBoardTiles(board, '.contact-sheet');
}

function boardUnit(board) {
  return board.offsetWidth / 100;
}

/* x, y, width are all % of board width so layout scales uniformly on resize. */
function migrateLegacyCoords(x, y, board) {
  const w = board.offsetWidth || 1200;
  const h = board.offsetHeight || Math.max(520, window.innerHeight * 0.75);
  return { x, y: ((y / 100) * h / w) * 100 };
}

/* Grows a board to fit the lowest item. */
function fitBoardHeight(board, { minHeight = 520, padding = 100, allowShrink = true, adjustScroll = true, pointerY = null } = {}) {
  if (board.classList.contains('board--narrow')) return;

  const floor = Math.max(minHeight, window.innerHeight * 0.75);
  const prevHeight = board.offsetHeight || floor;
  const scrollY = window.scrollY;
  const boardRect = board.getBoundingClientRect();

  let maxBottom = 0;
  board.querySelectorAll('.polaroid, .mini-polaroid, .contact-sheet').forEach(el => {
    const rect = el.getBoundingClientRect();
    maxBottom = Math.max(maxBottom, rect.bottom - boardRect.top);
  });

  if (pointerY != null) {
    maxBottom = Math.max(maxBottom, pointerY - boardRect.top);
  }

  let newHeight = Math.ceil(Math.max(maxBottom + padding, floor));
  if (!allowShrink) newHeight = Math.max(newHeight, prevHeight);
  if (newHeight === prevHeight) return;

  board.style.height = newHeight + 'px';

  const delta = newHeight - prevHeight;
  if (delta > 0 && adjustScroll && scrollY > 0) {
    window.scrollTo(0, scrollY + delta);
  }

  return newHeight;
}

function captureOriginLeftPx(tiles) {
  return new Map(tiles.map(t => [t.dataset.id, parseFloat(t.style.left) || 0]));
}

function captureOriginTopPx(tiles) {
  return new Map(tiles.map(t => [t.dataset.id, parseFloat(t.style.top) || 0]));
}

function createTileSelection(tileClass, { showOutline = true } = {}) {
  const selectedIds = new Set();
  const outlineClass = showOutline ? 'selected' : null;

  function setOutline(el, on) {
    if (!outlineClass) return;
    el.classList.toggle(outlineClass, on);
  }

  function clear(board) {
    selectedIds.clear();
    if (outlineClass) {
      board.querySelectorAll('.' + tileClass + '.' + outlineClass).forEach(el => {
        el.classList.remove(outlineClass);
      });
    }
  }

  function toggle(el) {
    const id = el.dataset.id;
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
      setOutline(el, false);
    } else {
      selectedIds.add(id);
      setOutline(el, true);
    }
  }

  function selectOnly(el, board) {
    clear(board);
    selectedIds.add(el.dataset.id);
    setOutline(el, true);
  }

  function selectAdd(el) {
    if (!selectedIds.has(el.dataset.id)) {
      selectedIds.add(el.dataset.id);
      setOutline(el, true);
    }
  }

  function isSelected(el) {
    return selectedIds.has(el.dataset.id);
  }

  function getDragGroup(board, el) {
    if (selectedIds.has(el.dataset.id) && selectedIds.size > 1) {
      if (outlineClass) {
        return Array.from(board.querySelectorAll('.' + tileClass + '.' + outlineClass));
      }
      return Array.from(board.querySelectorAll('.' + tileClass)).filter(t => selectedIds.has(t.dataset.id));
    }
    return [el];
  }

  function captureOrigins(tiles) {
    return new Map(tiles.map(t => [t.dataset.id, readTileCoords(t)]));
  }

  return { clear, toggle, selectOnly, selectAdd, isSelected, getDragGroup, captureOrigins };
}

function rectsIntersect(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isNearbyBox(a, b, radiusPx) {
  const expanded = {
    left: a.left - radiusPx,
    top: a.top - radiusPx,
    right: a.right + radiusPx,
    bottom: a.bottom + radiusPx
  };
  return rectsIntersect(expanded, b);
}

function findAxisSnap(movingValues, otherValues, thresholdPx) {
  let best = null;
  for (const moving of movingValues) {
    for (const other of otherValues) {
      const diff = other - moving;
      if (Math.abs(diff) <= thresholdPx && (!best || Math.abs(diff) < Math.abs(best.diff))) {
        best = { diff, guide: other };
      }
    }
  }
  return best;
}

function tileRectInBoard(el, board) {
  const br = board.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const left = r.left - br.left;
  const top = r.top - br.top;
  return {
    left,
    top,
    right: left + r.width,
    bottom: top + r.height,
    centerX: left + r.width / 2,
    centerY: top + r.height / 2,
    width: r.width,
    height: r.height
  };
}

function proposedGroupBox(dragTiles, originLeftPx, originTopPx, dx, dy) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  dragTiles.forEach(tile => {
    const id = tile.dataset.id;
    const left = originLeftPx.get(id) + dx;
    const top = originTopPx.get(id) + dy;
    const w = tile.offsetWidth || 0;
    const h = tile.offsetHeight || 0;
    minX = Math.min(minX, left);
    minY = Math.min(minY, top);
    maxX = Math.max(maxX, left + w);
    maxY = Math.max(maxY, top + h);
  });
  return {
    left: minX,
    top: minY,
    right: maxX,
    bottom: maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2
  };
}

/* Snap a drag group to nearby tiles (left/center/right, top/middle/bottom). */
function snapDragGroup(dragTiles, originLeftPx, originTopPx, dx, dy, board, {
  tileSelector = '.polaroid, .mini-polaroid',
  thresholdPx = 10,
  nearbyPx = 150,
  clampMin = -5,
  clampMax = 95
} = {}) {
  const u = boardUnit(board);
  const dragSet = new Set(dragTiles);
  const groupBox = proposedGroupBox(dragTiles, originLeftPx, originTopPx, dx, dy);

  const movingX = [groupBox.left, groupBox.right, groupBox.centerX];
  const movingY = [groupBox.top, groupBox.bottom, groupBox.centerY];

  let bestSnapX = null;
  let bestSnapY = null;

  board.querySelectorAll(tileSelector).forEach(other => {
    if (dragSet.has(other)) return;
    const otherRect = tileRectInBoard(other, board);
    if (!isNearbyBox(groupBox, otherRect, nearbyPx)) return;

    const snapX = findAxisSnap(
      movingX,
      [otherRect.left, otherRect.right, otherRect.centerX],
      thresholdPx
    );
    if (snapX && (!bestSnapX || Math.abs(snapX.diff) < Math.abs(bestSnapX.diff))) {
      bestSnapX = snapX;
    }

    const snapY = findAxisSnap(
      movingY,
      [otherRect.top, otherRect.bottom, otherRect.centerY],
      thresholdPx
    );
    if (snapY && (!bestSnapY || Math.abs(snapY.diff) < Math.abs(bestSnapY.diff))) {
      bestSnapY = snapY;
    }
  });

  const adjustX = bestSnapX?.diff ?? 0;
  const adjustY = bestSnapY?.diff ?? 0;

  const positions = dragTiles.map(tile => {
    const id = tile.dataset.id;
    const leftPx = originLeftPx.get(id) + dx + adjustX;
    const topPx = originTopPx.get(id) + dy + adjustY;
    return {
      tile,
      x: clamp(leftPx / u, clampMin, clampMax),
      y: Math.max(clampMin, topPx / u)
    };
  });

  return {
    positions,
    guideX: bestSnapX?.guide ?? null,
    guideY: bestSnapY?.guide ?? null
  };
}

function setBoardSnapGuides(board, guideX, guideY) {
  board.querySelector('.snap-guides')?.remove();
  if (guideX == null && guideY == null) return;

  const container = document.createElement('div');
  container.className = 'snap-guides';

  if (guideX != null) {
    const line = document.createElement('div');
    line.className = 'snap-guide-v';
    line.style.left = guideX + 'px';
    container.appendChild(line);
  }
  if (guideY != null) {
    const line = document.createElement('div');
    line.className = 'snap-guide-h';
    line.style.top = guideY + 'px';
    container.appendChild(line);
  }

  board.appendChild(container);
}

function clearBoardSnapGuides(board) {
  board.querySelector('.snap-guides')?.remove();
}

function enableBoardMarquee(board, selection, tileClass, { threshold = 6, skipIfNarrow = false, onSelectionChange = null } = {}) {
  if (board.dataset.marqueeEnabled) return;
  board.dataset.marqueeEnabled = '1';

  board.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (skipIfNarrow && board.classList.contains('board--narrow')) return;
    if (e.target.closest('.' + tileClass)) return;

    const additive = e.shiftKey;
    let startX = e.clientX;
    let startY = e.clientY;
    let box = null;
    let marqueeActive = false;

    if (!additive) selection.clear(board);

    function updateMarquee(clientX, clientY) {
      const boardRect = board.getBoundingClientRect();
      const left = Math.min(startX, clientX) - boardRect.left;
      const top = Math.min(startY, clientY) - boardRect.top;

      if (!box) {
        box = document.createElement('div');
        box.className = 'board-marquee';
        board.appendChild(box);
      }

      box.style.left = left + 'px';
      box.style.top = top + 'px';
      box.style.width = Math.abs(clientX - startX) + 'px';
      box.style.height = Math.abs(clientY - startY) + 'px';

      const marqueeRect = {
        left: Math.min(startX, clientX),
        top: Math.min(startY, clientY),
        right: Math.max(startX, clientX),
        bottom: Math.max(startY, clientY)
      };

      if (!additive) selection.clear(board);

      board.querySelectorAll('.' + tileClass).forEach(tile => {
        if (rectsIntersect(marqueeRect, tile.getBoundingClientRect())) {
          selection.selectAdd(tile);
        }
      });
    }

    function onMove(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!marqueeActive && Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
      marqueeActive = true;
      e.preventDefault();
      updateMarquee(e.clientX, e.clientY);
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (box) box.remove();
      else if (!additive) selection.clear(board);
      if (onSelectionChange) onSelectionChange();
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function probeMediaSrc(path, { timeoutMs = 10000 } = {}) {
  if (!path?.trim()) return Promise.resolve(false);
  /* Video files can't be probed with Image — never treat them as broken here. */
  if (isVideoPath(path)) return Promise.resolve(true);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    const img = new Image();
    img.onload = () => finish(img.naturalWidth > 0);
    img.onerror = () => finish(false);
    img.src = mediaSrc(path);
  });
}

async function filterLoadableSrcs(srcs, { concurrency = 6, timeoutMs = 10000 } = {}) {
  const list = [...new Set((srcs || []).filter(Boolean))];
  if (!list.length) return new Set();

  const loadable = new Set();
  let cursor = 0;

  async function worker() {
    while (cursor < list.length) {
      const src = list[cursor++];
      if (await probeMediaSrc(src, { timeoutMs })) loadable.add(src);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, list.length) },
    () => worker()
  );
  await Promise.all(workers);
  return loadable;
}

function attachBrokenImageHandler(img, onBroken) {
  if (!img || typeof onBroken !== 'function') return;
  img.addEventListener('error', () => onBroken(), { once: true });
}
