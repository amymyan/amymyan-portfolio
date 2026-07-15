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

/* Grows a board to fit the lowest item — used on live pages and organizer preview. */
function fitBoardHeight(board, { minHeight = 520, padding = 100 } = {}) {
  const floor = Math.max(minHeight, window.innerHeight * 0.75);
  let height = floor;

  for (let i = 0; i < 10; i++) {
    board.style.height = height + 'px';
    let maxBottom = 0;
    board.querySelectorAll('.polaroid, .mini-polaroid').forEach(el => {
      maxBottom = Math.max(maxBottom, el.offsetTop + el.offsetHeight);
    });
    const next = Math.max(floor, maxBottom + padding);
    if (Math.abs(next - height) < 3) {
      height = next;
      break;
    }
    height = next;
  }

  board.style.height = height + 'px';
}
