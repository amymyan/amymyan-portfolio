/* ============================================================
   BOARD SCRIPT — used by music.html, projects.html, and every
   individual project-*.html page.
   ============================================================
   One shared script drives all "board" pages. Each page tells it
   what to do via attributes on the <main id="board"> element:

     data-source        which JSON file to load, e.g. "data/music.json"
     data-show-captions "true" to show each photo's caption as
                          visible text (used on projects.html so you
                          can see each project's title). Leave this
                          off (or "false") to keep captions invisible,
                          which is what music.html and project pages do.

   BEHAVIOR:
   - On wide screens (tablet/laptop, wider than 700px): photos are
     scattered freely at whatever x/y position and width you set in
     the organizer, and a visitor can drag them anywhere. Clicking a
     photo (without dragging it) opens it full-size in a lightbox —
     UNLESS that photo has an "href" in its JSON entry, in which case
     clicking it navigates to that link instead (this is how the
     projects listing page works: cover photos link to a project page
     instead of opening a lightbox).
   - On narrow screens (phones, 700px or under): photos lay out in a
     simple wrapping grid instead of scattered around. You can still
     drag a photo to reorder it relative to the others, but you can't
     scatter it anywhere — that's intentional, so it stays tidy on a
     small screen.
   ============================================================ */

const boardEl = document.getElementById('board');
const DATA_SOURCE = boardEl.dataset.source;
const SHOW_CAPTIONS = boardEl.dataset.showCaptions === 'true';

/* Each board page gets its own separate "remember where I dragged
   things" storage, based on its data file's name, so dragging on
   the music page doesn't affect the projects page and so on. */
const STORAGE_KEY = 'amy-board-layout-v3::' + DATA_SOURCE;
const MOBILE_ORDER_KEY = 'amy-board-mobile-order-v1::' + DATA_SOURCE;

/* The screen-width cutoff for switching from scattered (wide) to
   grid (narrow/phone) mode. Lower this number to switch to grid
   mode on more devices (e.g. small tablets); raise it to only use
   grid mode on very small phones. */
const MOBILE_BREAKPOINT = 700;

/* If a visitor drags a photo less than this many pixels, we treat
   it as a "click" (open the lightbox / follow the link) instead of
   a drag. Raise this if clicks are being mistaken for tiny drags. */
const CLICK_VS_DRAG_THRESHOLD = 6;

const DEFAULT_WIDTH = 220; // used if a photo's JSON entry has no "width"

let photos = [];

/* ---------------- loading data ---------------- */

async function loadPhotos() {
  const res = await fetch(DATA_SOURCE);
  return res.json();
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

/* ---------------- lightbox ----------------
   One overlay, shared by every photo on the page. Opening it swaps
   in whichever photo/video was clicked. */

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
    if (e.target === overlay) close(); // clicking the dark backdrop closes it
  });
  overlay.querySelector('.lightbox-close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  return {
    open(photo) {
      const content = overlay.querySelector('.lightbox-content');
      content.innerHTML = '';
      if (/\.(mp4|webm|mov)$/i.test(photo.src)) {
        const video = document.createElement('video');
        video.src = photo.src;
        video.controls = true;
        video.autoplay = true;
        content.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.src = photo.src;
        img.alt = photo.caption || '';
        content.appendChild(img);
      }
      overlay.classList.add('open');
    }
  };
}

const lightbox = buildLightbox();

/* ---------------- building each photo tile ---------------- */

function createTile(photo) {
  const el = document.createElement('div');
  el.className = 'polaroid';
  el.dataset.id = photo.id;

  const width = photo.width || DEFAULT_WIDTH;
  el.style.width = width + 'px';

  if (photo.src) {
    const isVideo = /\.(mp4|webm|mov)$/i.test(photo.src);
    if (isVideo) {
      const video = document.createElement('video');
      video.src = photo.src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = true;
      el.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = photo.src;
      img.alt = photo.caption || '';
      el.appendChild(img);
    }
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    placeholder.style.width = width + 'px';
    placeholder.style.height = width + 'px';
    placeholder.textContent = 'add photo via organizer.html';
    el.appendChild(placeholder);
  }

  if (SHOW_CAPTIONS && photo.caption) {
    const cap = document.createElement('p');
    cap.className = 'caption';
    cap.textContent = photo.caption;
    el.appendChild(cap);
  }

  /* What happens when this tile is clicked (not dragged):
     - if it has an "href" in its JSON entry, go to that page
     - otherwise, open it in the lightbox */
  el.addEventListener('tile-activate', () => {
    if (photo.href) {
      window.location.href = photo.href;
    } else if (photo.src) {
      lightbox.open(photo);
    }
  });

  return el;
}

/* ---------------- WIDE MODE: freeform scatter + drag ---------------- */

function layoutWide(board, layout) {
  board.classList.remove('board--narrow');
  photos.forEach(photo => {
    const el = createTile(photo);
    const saved = layout[photo.id];
    const x = saved ? saved.x : photo.x;
    const y = saved ? saved.y : photo.y;
    el.style.position = 'absolute';
    el.style.left = x + '%';
    el.style.top = y + '%';
    board.appendChild(el);
    makeFreeformDraggable(el, board, photo);
  });
}

function makeFreeformDraggable(el, board, photo) {
  let startClientX, startClientY, originLeft, originTop, moved;

  function toPercent(px, total) { return (px / total) * 100; }

  function onPointerDown(e) {
    e.preventDefault();
    const boardRect = board.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    startClientX = point.clientX;
    startClientY = point.clientY;
    originLeft = parseFloat(el.style.left);
    originTop = parseFloat(el.style.top);
    moved = 0;

    function onMove(e) {
      const point = e.touches ? e.touches[0] : e;
      const dx = point.clientX - startClientX;
      const dy = point.clientY - startClientY;
      moved = Math.max(moved, Math.abs(dx), Math.abs(dy));

      if (moved > CLICK_VS_DRAG_THRESHOLD) {
        el.classList.add('dragging');
        board.appendChild(el); // bring to front
        let newLeft = originLeft + toPercent(dx, boardRect.width);
        let newTop = originTop + toPercent(dy, boardRect.height);
        newLeft = Math.max(-5, Math.min(95, newLeft));
        newTop = Math.max(-5, Math.min(95, newTop));
        el.style.left = newLeft + '%';
        el.style.top = newTop + '%';
      }
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      el.classList.remove('dragging');

      if (moved > CLICK_VS_DRAG_THRESHOLD) {
        // it was a real drag — remember the new position for this visitor
        const layout = getSavedLayout();
        layout[el.dataset.id] = {
          x: parseFloat(el.style.left),
          y: parseFloat(el.style.top)
        };
        saveLayout(layout);
      } else {
        // it was just a click/tap — open the lightbox or navigate
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

/* ---------------- NARROW MODE: wrapping grid + reorder drag ---------------- */

function layoutNarrow(board) {
  board.classList.add('board--narrow');

  // work out display order: saved order first, then any photos
  // not yet in that saved order (e.g. newly-added ones), in their
  // original data-file order
  const savedOrder = getSavedMobileOrder();
  const byId = Object.fromEntries(photos.map(p => [p.id, p]));
  const ordered = [
    ...savedOrder.map(id => byId[id]).filter(Boolean),
    ...photos.filter(p => !savedOrder.includes(p.id))
  ];

  ordered.forEach(photo => {
    const el = createTile(photo);
    el.style.position = 'static'; // normal grid flow, not scattered
    board.appendChild(el);
    makeReorderDraggable(el, board);
  });
}

function makeReorderDraggable(el, board) {
  let startClientX, startClientY, moved;

  function onPointerDown(e) {
    e.preventDefault();
    const point = e.touches ? e.touches[0] : e;
    startClientX = point.clientX;
    startClientY = point.clientY;
    moved = 0;

    function onMove(e) {
      const point = e.touches ? e.touches[0] : e;
      const dx = point.clientX - startClientX;
      const dy = point.clientY - startClientY;
      moved = Math.max(moved, Math.abs(dx), Math.abs(dy));

      if (moved > CLICK_VS_DRAG_THRESHOLD) {
        el.classList.add('dragging');
        // find whichever OTHER tile is currently under the pointer,
        // and move this tile to sit right before/after it
        const target = document.elementFromPoint(point.clientX, point.clientY);
        const targetTile = target ? target.closest('.polaroid') : null;
        if (targetTile && targetTile !== el && board.contains(targetTile)) {
          const rect = targetTile.getBoundingClientRect();
          const before = point.clientX < rect.left + rect.width / 2;
          board.insertBefore(el, before ? targetTile : targetTile.nextSibling);
        }
      }
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      el.classList.remove('dragging');

      if (moved > CLICK_VS_DRAG_THRESHOLD) {
        // save the new order everyone's tiles ended up in
        const idsInOrder = Array.from(board.querySelectorAll('.polaroid')).map(t => t.dataset.id);
        saveMobileOrder(idsInOrder);
      } else {
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

/* ---------------- put it all together ---------------- */

function renderBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';
  const layout = getSavedLayout();

  if (isNarrowScreen()) {
    layoutNarrow(board);
  } else {
    layoutWide(board, layout);
  }
}

async function initBoard() {
  photos = await loadPhotos();
  renderBoard();

  // if the visitor resizes their window (or rotates their phone)
  // across the mobile breakpoint, rebuild the board in the new mode
  let lastIsNarrow = isNarrowScreen();
  window.addEventListener('resize', () => {
    const nowNarrow = isNarrowScreen();
    if (nowNarrow !== lastIsNarrow) {
      lastIsNarrow = nowNarrow;
      renderBoard();
    }
  });
}

initBoard();
