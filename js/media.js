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

/* Grows a board to fit the lowest item — works with % top positions. */
function fitBoardHeight(board, { minHeight = 520, padding = 100, allowShrink = true } = {}) {
  if (board.classList.contains('board--narrow')) return;

  const floor = Math.max(minHeight, window.innerHeight * 0.75);
  const prevHeight = board.offsetHeight || floor;
  const scrollY = window.scrollY;

  let required = floor;
  board.querySelectorAll('.polaroid, .mini-polaroid').forEach(el => {
    const elH = el.offsetHeight || el.getBoundingClientRect().height || 0;
    if (!elH) return;

    const topPct = parseFloat(el.style.top);
    if (!Number.isFinite(topPct)) return;

    const denom = 1 - topPct / 100;
    if (denom > 0.05) {
      required = Math.max(required, (elH + padding) / denom);
    } else {
      required = Math.max(required, elH + padding + floor);
    }
  });

  let newHeight = Math.ceil(Math.max(required, floor));
  if (!allowShrink) newHeight = Math.max(newHeight, prevHeight);
  if (newHeight === prevHeight) return;

  board.style.height = newHeight + 'px';

  const delta = newHeight - prevHeight;
  if (delta > 0 && scrollY > 0) {
    window.scrollTo(0, scrollY + delta);
  }
}

function createTileSelection(tileClass) {
  const selectedIds = new Set();

  function clear(board) {
    selectedIds.clear();
    board.querySelectorAll('.' + tileClass + '.selected').forEach(el => el.classList.remove('selected'));
  }

  function toggle(el) {
    const id = el.dataset.id;
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
      el.classList.remove('selected');
    } else {
      selectedIds.add(id);
      el.classList.add('selected');
    }
  }

  function selectOnly(el, board) {
    clear(board);
    selectedIds.add(el.dataset.id);
    el.classList.add('selected');
  }

  function selectAdd(el) {
    if (!selectedIds.has(el.dataset.id)) {
      selectedIds.add(el.dataset.id);
      el.classList.add('selected');
    }
  }

  function getDragGroup(board, el) {
    if (selectedIds.has(el.dataset.id) && selectedIds.size > 1) {
      return Array.from(board.querySelectorAll('.' + tileClass + '.selected'));
    }
    return [el];
  }

  function captureOrigins(tiles) {
    return new Map(tiles.map(t => [t.dataset.id, {
      left: parseFloat(t.style.left),
      top: parseFloat(t.style.top)
    }]));
  }

  return { clear, toggle, selectOnly, selectAdd, getDragGroup, captureOrigins };
}

function rectsIntersect(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function enableBoardMarquee(board, selection, tileClass, { threshold = 6, skipIfNarrow = false } = {}) {
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
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
