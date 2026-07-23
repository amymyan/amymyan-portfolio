/* ============================================================
   BOARD SCRIPT — used by music.html, projects.html, and every
   individual project-*.html page.
   ============================================================ */

const boardEl = document.getElementById('board');
const DATA_SOURCE = boardEl.dataset.source;
const SHOW_CAPTIONS = boardEl.dataset.showCaptions === 'true';

const STORAGE_KEY = 'amy-board-layout-v3::' + DATA_SOURCE;
const COORDS_KEY = 'amy-board-coords-v2::' + DATA_SOURCE;
const MOBILE_ORDER_KEY = 'amy-board-mobile-order-v1::' + DATA_SOURCE;
const MOBILE_BREAKPOINT = 700;
const CLICK_VS_DRAG_THRESHOLD = 6;

let photos = [];

async function loadPhotos() {
  const res = await fetch(DATA_SOURCE);
  if (!res.ok) throw new Error(DATA_SOURCE + ' returned ' + res.status);
  const raw = await res.json();
  return raw
    .filter(item => item.src?.trim() || item.href)
    .map((item, index) => ({
    id: item.id || ('p' + index + '-' + (item.src || 'empty').split('/').pop()),
    src: item.src || '',
    caption: item.caption || '',
    x: typeof item.x === 'number' ? item.x : 10,
    y: typeof item.y === 'number' ? item.y : 5,
    width: normalizeWidthPercent(item.width),
    rotation: normalizeRotation(item.rotation),
    ...(item.href ? { href: item.href } : {}),
    ...(item.poster ? { poster: item.poster } : {})
  }));
}

function showBoardError(messageHtml) {
  document.getElementById('board').innerHTML = '<p class="board-error">' + messageHtml + '</p>';
}

function getSavedLayout() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}
function saveLayout(layout) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

function getSavedMobileOrder() {
  try { return JSON.parse(localStorage.getItem(MOBILE_ORDER_KEY)) || []; }
  catch { return []; }
}
function saveMobileOrder(idsInOrder) {
  localStorage.setItem(MOBILE_ORDER_KEY, JSON.stringify(idsInOrder));
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
      if (isVideoPath(photo.src)) {
        const video = document.createElement('video');
        video.src = mediaSrc(photo.src);
        video.controls = true;
        video.autoplay = true;
        content.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.src = mediaSrc(photo.src);
        img.alt = photo.caption || '';
        content.appendChild(img);
      }
      overlay.classList.add('open');
    }
  };
}

const lightbox = buildLightbox();
const tileSelection = createTileSelection('polaroid', { showOutline: false });

function scheduleBoardRefit() {
  const board = document.getElementById('board');
  if (board && !board.classList.contains('board--narrow')) {
    requestAnimationFrame(() => fitBoardHeight(board));
  }
}

function createTile(photo) {
  const el = document.createElement('div');
  el.className = 'polaroid';
  el.dataset.id = photo.id;

  const width = photo.width || DEFAULT_WIDTH_PERCENT;
  el.style.width = width + '%'; // placeholder until applyTileLayout runs

  const isVideo = isVideoPath(photo.src);

  if (photo.src) {
    if (isVideo) {
      const video = document.createElement('video');
      video.src = mediaSrc(photo.src);
      video.playsInline = true;
      video.preload = 'metadata';
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      if (photo.poster) video.poster = mediaSrc(photo.poster);
      video.addEventListener('loadedmetadata', scheduleBoardRefit);
      video.addEventListener('error', () => el.remove());
      video.addEventListener('ended', () => {
        video.pause();
        video.load();
      });
      el.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = mediaSrc(photo.src);
      img.alt = photo.caption || '';
      img.addEventListener('load', scheduleBoardRefit);
      img.addEventListener('error', () => el.remove());
      el.appendChild(img);
    }
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    placeholder.style.aspectRatio = '1';
    placeholder.textContent = 'add photo via organizer.html';
    el.appendChild(placeholder);
  }

  if (SHOW_CAPTIONS && photo.caption) {
    const cap = document.createElement('p');
    cap.className = 'caption';
    cap.textContent = photo.caption;
    el.appendChild(cap);
  }

  if (isVideo && photo.caption) {
    const cap = document.createElement('p');
    cap.className = 'video-caption';
    cap.textContent = photo.caption;
    el.appendChild(cap);
  }

  el.addEventListener('tile-activate', () => {
    if (photo.href) {
      window.location.href = photo.href;
    } else if (isVideo) {
      const video = el.querySelector('video');
      if (video) {
        if (video.paused) video.play();
        else video.pause();
      }
    } else if (photo.src) {
      lightbox.open(photo);
    }
  });

  return el;
}

function layoutWide(board, layout) {
  board.classList.remove('board--narrow');
  const legacy = !localStorage.getItem(COORDS_KEY);

  photos.forEach(photo => {
    const el = createTile(photo);
    const saved = layout[photo.id];
    let x = saved ? saved.x : photo.x;
    let y = saved ? saved.y : photo.y;
    const width = photo.width || DEFAULT_WIDTH_PERCENT;
    const rotation = photo.rotation || 0;
    if (legacy) ({ x, y } = migrateLegacyCoords(x, y, board));

    el.style.position = 'absolute';
    applyTileLayout(el, board, { x, y, width, rotation });
    board.appendChild(el);
    makeFreeformDraggable(el, board, photo);
  });

  if (legacy) localStorage.setItem(COORDS_KEY, '1');
}

function shouldSkipDrag(e) {
  return e.target.closest('.video-caption');
}

function makeFreeformDraggable(el, board, photo) {
  let startClientX, startClientY, moved, shiftHeld, dragGroup, originLeftPx, originTopPx;

  function applyDragPositions(point) {
    const dx = point.clientX - startClientX;
    const dy = point.clientY - startClientY;

    const { positions, guideX, guideY } = snapDragGroup(
      dragGroup,
      originLeftPx,
      originTopPx,
      dx,
      dy,
      board
    );

    positions.forEach(({ tile, x, y }) => {
      tile.classList.add('dragging');
      board.appendChild(tile);
      applyTileLayout(tile, board, {
        x,
        y,
        width: parseFloat(tile.dataset.w),
        rotation: parseFloat(tile.dataset.rotation) || 0
      });
    });
    setBoardSnapGuides(board, guideX, guideY);
    fitBoardHeight(board, { allowShrink: false, adjustScroll: false, pointerY: point.clientY });
  }

  function onPointerDown(e) {
    if (shouldSkipDrag(e)) return;
    e.preventDefault();
    const point = e.touches ? e.touches[0] : e;
    startClientX = point.clientX;
    startClientY = point.clientY;
    moved = 0;
    shiftHeld = e.shiftKey;

    if (shiftHeld) {
      tileSelection.toggle(el);
    } else if (!tileSelection.isSelected(el)) {
      tileSelection.selectOnly(el, board);
    }

    dragGroup = tileSelection.getDragGroup(board, el);
    originLeftPx = captureOriginLeftPx(dragGroup);
    originTopPx = captureOriginTopPx(dragGroup);

    function onMove(e) {
      const point = e.touches ? e.touches[0] : e;
      const dx = point.clientX - startClientX;
      const dy = point.clientY - startClientY;
      moved = Math.max(moved, Math.abs(dx), Math.abs(dy));

      if (moved > CLICK_VS_DRAG_THRESHOLD) {
        applyDragPositions(point);
      }
    }

    function onUp(e) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      dragGroup.forEach(tile => tile.classList.remove('dragging'));
      clearBoardSnapGuides(board);

      if (moved > CLICK_VS_DRAG_THRESHOLD) {
        const point = e.changedTouches ? e.changedTouches[0] : e;
        applyDragPositions(point);
        fitBoardHeight(board, { allowShrink: false });

        const layout = getSavedLayout();
        dragGroup.forEach(tile => {
          layout[tile.dataset.id] = {
            x: parseFloat(tile.dataset.x),
            y: parseFloat(tile.dataset.y)
          };
        });
        saveLayout(layout);
      } else if (!shiftHeld) {
        el.dispatchEvent(new CustomEvent('tile-activate'));
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }

  el.addEventListener('mousedown', onPointerDown);
  el.addEventListener('touchstart', onPointerDown, { passive: false });
}

function attachTileTap(el) {
  el.addEventListener('click', () => {
    el.dispatchEvent(new CustomEvent('tile-activate'));
  });
}

function layoutNarrow(board) {
  board.classList.add('board--narrow');

  const savedOrder = getSavedMobileOrder();
  const byId = Object.fromEntries(photos.map(p => [p.id, p]));
  const ordered = [
    ...savedOrder.map(id => byId[id]).filter(Boolean),
    ...photos.filter(p => !savedOrder.includes(p.id))
  ];

  ordered.forEach(photo => {
    const el = createTile(photo);
    el.style.position = 'static';
    el.style.width = '100%';
    board.appendChild(el);
    attachTileTap(el);
  });
}

function renderBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  tileSelection.clear(board);
  const layout = getSavedLayout();

  if (isNarrowScreen()) {
    layoutNarrow(board);
    board.style.height = 'auto';
  } else {
    layoutWide(board, layout);
    requestAnimationFrame(() => fitBoardHeight(board));
  }
}

async function initBoard() {
  if (window.location.protocol === 'file:') {
    showBoardError(
      'photos can\u2019t load when you double-click an html file.<br><br>' +
      'start a local server in your project folder, then open the site in your browser:<br>' +
      '<code>python3 -m http.server 8000</code><br><br>' +
      'then go to <strong>http://localhost:8000</strong>'
    );
    return;
  }

  try {
    photos = await loadPhotos();
    renderBoard();
    enableBoardMarquee(
      document.getElementById('board'),
      tileSelection,
      'polaroid',
      { skipIfNarrow: true }
    );
  } catch (err) {
    console.error('Board load failed:', err);
    showBoardError(
      'couldn\u2019t load photos from <code>' + DATA_SOURCE + '</code>.<br><br>' +
      'open the site through a local server (not by double-clicking the html file).'
    );
    return;
  }

  let lastIsNarrow = isNarrowScreen();
  window.addEventListener('resize', () => {
    const nowNarrow = isNarrowScreen();
    const board = document.getElementById('board');
    if (nowNarrow !== lastIsNarrow) {
      lastIsNarrow = nowNarrow;
      renderBoard();
    } else if (!nowNarrow && board) {
      reflowBoardTiles(board);
      fitBoardHeight(board);
    }
  });
}

initBoard();
