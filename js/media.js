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
