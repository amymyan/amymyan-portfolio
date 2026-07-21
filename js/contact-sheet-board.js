/* Live music page — contact sheet boards */

const boardEl = document.getElementById('board');
const DATA_SOURCE = boardEl.dataset.source;
const MOBILE_BREAKPOINT = 700;
const HOVER_PREVIEW_DELAY_MS = 550;

let sheets = [];
let hoverPreview = null;

async function loadSheets() {
  const res = await fetch(DATA_SOURCE);
  if (!res.ok) throw new Error(DATA_SOURCE + ' returned ' + res.status);
  const raw = await res.json();
  return getContactSheets(raw);
}

function showBoardError(messageHtml) {
  boardEl.innerHTML = '<p class="board-error">' + messageHtml + '</p>';
}

function localServerHelpHtml() {
  return (
    'start a local server in your project folder, then open the site in your browser:<br>' +
    '<code>python3 -m http.server 8000</code><br><br>' +
    'then go to <strong>http://localhost:8000/music.html</strong> (not the file in Finder)'
  );
}

function describeSheetLoadError(err) {
  if (window.location.protocol === 'file:') {
    return (
      'photos can\u2019t load when you double-click an html file.<br><br>' +
      localServerHelpHtml()
    );
  }
  const missing = [];
  if (typeof normalizeWidthPercent !== 'function' || typeof mediaSrc !== 'function') {
    missing.push('js/amy-media.js');
  }
  if (typeof getContactSheets !== 'function') {
    missing.push('js/contact-sheet.js');
  }
  if (missing.length) {
    return (
      'a required script didn\u2019t load: <code>' + missing.join('</code>, <code>') + '</code>.<br><br>' +
      'this often happens when an ad blocker blocks a file name. try disabling extensions for localhost, or hard-refresh (<code>cmd+shift+r</code>).'
    );
  }
  const msg = err?.message || String(err || 'unknown error');
  if (msg.includes('404') || msg.includes(' returned 404')) {
    return (
      'couldn\u2019t find <code>' + DATA_SOURCE + '</code> (404).<br><br>' +
      'start the server from the portfolio folder, not a parent folder:<br>' +
      localServerHelpHtml() +
      '<br><br><small>' + msg + '</small>'
    );
  }
  if (err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(msg)) {
    return (
      'couldn\u2019t reach <code>' + DATA_SOURCE + '</code>.<br><br>' +
      'if <code>python3 -m http.server 8000</code> says \u201caddress already in use\u201d, try port 8080 instead:<br>' +
      '<code>python3 -m http.server 8080</code><br><br>' +
      'then open <strong>http://localhost:8080/music.html</strong><br><br>' +
      '<small>' + msg + '</small>'
    );
  }
  return (
    'couldn\u2019t load photos from <code>' + DATA_SOURCE + '</code>.<br><br>' +
    localServerHelpHtml() +
    '<br><br><small>' + msg + '</small>'
  );
}

function isNarrowScreen() {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
}

function buildLightbox() {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.innerHTML = `
    <button class="lightbox-close" aria-label="close">&times;</button>
    <div class="lightbox-content"></div>
  `;
  document.body.appendChild(overlay);

  function close() {
    overlay.classList.remove('open');
    overlay.querySelector('.lightbox-content').innerHTML = '';
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('.lightbox-close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  return {
    open(photo) {
      const content = overlay.querySelector('.lightbox-content');
      content.innerHTML = '';
      const img = document.createElement('img');
      img.src = mediaSrc(photo.src);
      img.alt = photo.caption || '';
      content.appendChild(img);
      overlay.classList.add('open');
    }
  };
}

const lightbox = buildLightbox();

function initHoverPreview() {
  const el = document.createElement('div');
  el.id = 'contact-hover-preview';
  const img = document.createElement('img');
  img.alt = '';
  img.decoding = 'async';
  el.appendChild(img);
  document.body.appendChild(el);
  hoverPreview = {
    el,
    img,
    pendingSrc: null,
    anchorRect: null,
    closeTimer: null,
    openTimer: null,
    hoverFrame: null
  };
}

function clearHoverOpenTimer() {
  if (!hoverPreview?.openTimer) return;
  clearTimeout(hoverPreview.openTimer);
  hoverPreview.openTimer = null;
}

function hideHoverPreview() {
  if (!hoverPreview) return;
  clearHoverOpenTimer();
  hoverPreview.hoverFrame = null;
  const { el } = hoverPreview;
  if (hoverPreview.closeTimer) {
    clearTimeout(hoverPreview.closeTimer);
    hoverPreview.closeTimer = null;
  }
  hoverPreview.pendingSrc = null;
  hoverPreview.anchorRect = null;
  if (!el.classList.contains('is-visible')) return;

  el.classList.remove('is-visible');
  el.classList.add('is-closing');

  function finishClose() {
    el.classList.remove('is-closing');
    el.removeEventListener('transitionend', finishClose);
  }

  el.addEventListener('transitionend', finishClose);
  hoverPreview.closeTimer = setTimeout(finishClose, 260);
}

function showHoverPreview(anchorRect) {
  const { el, img } = hoverPreview;
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh) return;

  if (hoverPreview.closeTimer) {
    clearTimeout(hoverPreview.closeTimer);
    hoverPreview.closeTimer = null;
    el.classList.remove('is-closing');
  }

  const maxW = window.innerWidth * 0.88;
  const maxH = window.innerHeight * 0.88;
  let w = nw;
  let h = nh;
  if (w > maxW) {
    h = (h * maxW) / w;
    w = maxW;
  }
  if (h > maxH) {
    w = (w * maxH) / h;
    h = maxH;
  }

  let left = anchorRect.left + anchorRect.width / 2 - w / 2;
  let top = anchorRect.top + anchorRect.height / 2 - h / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
  top = Math.max(8, Math.min(top, window.innerHeight - h - 8));

  const thumbCx = anchorRect.left + anchorRect.width / 2;
  const thumbCy = anchorRect.top + anchorRect.height / 2;
  const originX = ((thumbCx - left) / w) * 100;
  const originY = ((thumbCy - top) / h) * 100;

  el.style.width = w + 'px';
  el.style.height = h + 'px';
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  el.style.transformOrigin = `${originX}% ${originY}%`;

  const startScale = Math.max(0.2, Math.min(anchorRect.width / w, anchorRect.height / h));
  el.classList.remove('is-visible');
  el.style.transform = `scale(${startScale})`;
  el.style.opacity = '0';

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.classList.add('is-visible');
      el.style.removeProperty('transform');
      el.style.removeProperty('opacity');
    });
  });
}

function positionHoverPreview(frame) {
  if (!frame || hoverPreview.hoverFrame !== frame) return;
  const anchorRect = frame.getBoundingClientRect();
  hoverPreview.anchorRect = anchorRect;
  showHoverPreview(anchorRect);
}

function scheduleHoverPreview(frame, src) {
  clearHoverOpenTimer();
  hoverPreview.hoverFrame = frame;
  hoverPreview.pendingSrc = src;

  const { img } = hoverPreview;
  if (img.src !== src) {
    img.src = src;
  }

  hoverPreview.openTimer = setTimeout(() => {
    hoverPreview.openTimer = null;
    if (hoverPreview.hoverFrame !== frame) return;

    if (img.complete && img.naturalWidth) {
      positionHoverPreview(frame);
      return;
    }

    img.onload = () => {
      if (hoverPreview.hoverFrame !== frame || hoverPreview.pendingSrc !== src) return;
      positionHoverPreview(frame);
    };
  }, HOVER_PREVIEW_DELAY_MS);
}

function attachLiveFrame(frame, frameData) {
  const src = mediaSrc(frameData.src);

  frame.addEventListener('mouseenter', () => {
    scheduleHoverPreview(frame, src);
  });

  frame.addEventListener('mouseleave', hideHoverPreview);

  frame.addEventListener('click', (e) => {
    e.stopPropagation();
    hideHoverPreview();
    lightbox.open({ src: frameData.src });
  });
}

function createSheetElement(sheet) {
  return buildContactSheetElement(sheet, {
    mode: 'live',
    attachLiveFrame
  });
}

function sortSheetsByBoardPosition(list) {
  return [...list].sort((a, b) => {
    const dy = (a.y ?? 0) - (b.y ?? 0);
    if (dy !== 0) return dy;
    return (a.x ?? 0) - (b.x ?? 0);
  });
}

function layoutWide(board) {
  board.classList.remove('board--narrow');

  sheets.forEach(sheet => {
    const el = createSheetElement(sheet);
    const x = sheet.x;
    const y = sheet.y;
    const width = sheet.width || DEFAULT_SHEET_WIDTH;
    const rotation = sheet.rotation || 0;

    el.style.position = 'absolute';
    applyTileLayout(el, board, { x, y, width, rotation });
    board.appendChild(el);
  });
}

function layoutNarrow(board) {
  board.classList.add('board--narrow');
  sortSheetsByBoardPosition(sheets).forEach(sheet => {
    const el = createSheetElement(sheet);
    el.style.position = 'static';
    el.style.width = '100%';
    board.appendChild(el);
  });
}

function renderBoard() {
  boardEl.innerHTML = '';
  hideHoverPreview();

  if (isNarrowScreen()) {
    layoutNarrow(boardEl);
    boardEl.style.height = 'auto';
  } else {
    layoutWide(boardEl);
    requestAnimationFrame(() => {
      reflowContactSheets(boardEl);
      fitBoardHeight(boardEl);
    });
  }
}

async function initBoard() {
  boardEl.classList.add('contact-sheet-board');
  initHoverPreview();

  if (window.location.protocol === 'file:') {
    showBoardError(describeSheetLoadError({}));
    return;
  }

  const preloadError = describeSheetLoadError(null);
  if (typeof normalizeWidthPercent !== 'function' || typeof getContactSheets !== 'function') {
    showBoardError(preloadError);
    return;
  }

  try {
    sheets = await loadSheets();
    renderBoard();
  } catch (err) {
    console.error('Contact sheet load failed:', err);
    showBoardError(describeSheetLoadError(err));
    return;
  }

  let lastIsNarrow = isNarrowScreen();
  window.addEventListener('resize', () => {
    hideHoverPreview();
    const nowNarrow = isNarrowScreen();
    if (nowNarrow !== lastIsNarrow) {
      lastIsNarrow = nowNarrow;
      renderBoard();
    } else if (!nowNarrow) {
      reflowContactSheets(boardEl);
      fitBoardHeight(boardEl);
    }
  });
}

initBoard();
