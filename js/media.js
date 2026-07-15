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

/* Converts legacy pixel widths (e.g. 500) to % of board width.
   Values already 5–95 are treated as percent. */
function normalizeWidthPercent(value, referenceWidthPx = 1200) {
  if (value == null || value === '') return DEFAULT_WIDTH_PERCENT;
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_WIDTH_PERCENT;
  if (n > 100) return Math.min(95, Math.round((n / referenceWidthPx) * 100));
  return Math.max(5, Math.min(95, Math.round(n)));
}

function formatVideoTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins + ':' + String(secs).padStart(2, '0');
}

function attachVideoControls(tileEl, video) {
  tileEl.classList.add('has-video');

  const controls = document.createElement('div');
  controls.className = 'video-controls';

  const playBtn = document.createElement('button');
  playBtn.type = 'button';
  playBtn.className = 'video-play-btn';
  playBtn.setAttribute('aria-label', 'play or pause');
  playBtn.textContent = '\u25b6';

  const progress = document.createElement('input');
  progress.type = 'range';
  progress.className = 'video-progress';
  progress.min = 0;
  progress.max = 1000;
  progress.value = 0;
  progress.setAttribute('aria-label', 'video progress');

  const timeEl = document.createElement('span');
  timeEl.className = 'video-time';
  timeEl.textContent = '0:00';

  controls.append(playBtn, progress, timeEl);
  tileEl.appendChild(controls);

  function stopDrag(e) { e.stopPropagation(); }
  controls.addEventListener('mousedown', stopDrag);
  controls.addEventListener('touchstart', stopDrag, { passive: false });

  function syncPlayIcon() {
    playBtn.textContent = video.paused ? '\u25b6' : '\u23f8';
  }

  playBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (video.paused) video.play();
    else video.pause();
  });

  let seeking = false;

  progress.addEventListener('input', () => {
    seeking = true;
    if (video.duration) {
      timeEl.textContent = formatVideoTime((progress.value / 1000) * video.duration);
    }
  });

  progress.addEventListener('change', () => {
    if (video.duration) {
      video.currentTime = (progress.value / 1000) * video.duration;
    }
    seeking = false;
  });

  video.addEventListener('timeupdate', () => {
    if (!seeking && video.duration) {
      progress.value = (video.currentTime / video.duration) * 1000;
      timeEl.textContent = formatVideoTime(video.currentTime);
    }
  });

  video.addEventListener('play', syncPlayIcon);
  video.addEventListener('pause', syncPlayIcon);
  video.addEventListener('loadedmetadata', () => {
    timeEl.textContent = formatVideoTime(video.currentTime);
  });

  syncPlayIcon();
}
