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
