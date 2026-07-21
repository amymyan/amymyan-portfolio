/* Contact sheet helpers — shared by music page and organizer */

const DEFAULT_FILM_STOCK = 'KODAK PORTRA 400';
const DEFAULT_SHEET_WIDTH = 38;
const DEFAULT_COLS_PER_ROW = 3;

function isContactSheetPage(pageName) {
  return pageName === 'music';
}

function isContactSheetFormat(data) {
  return data && typeof data === 'object' && !Array.isArray(data) && Array.isArray(data.sheets);
}

function normalizeCols(value) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return DEFAULT_COLS_PER_ROW;
  return Math.max(1, Math.min(8, n));
}

function normalizeFrameFocus(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeContactFrame(frame, index) {
  return {
    id: frame.id || ('f' + Date.now() + Math.floor(Math.random() * 1000) + index),
    src: frame.src || '',
    rotation: normalizeRotation(frame.rotation),
    focusX: normalizeFrameFocus(frame.focusX),
    focusY: normalizeFrameFocus(frame.focusY)
  };
}

function applyFrameFocus(img, frameData) {
  img.style.objectPosition = `${normalizeFrameFocus(frameData.focusX)}% ${normalizeFrameFocus(frameData.focusY)}%`;
}

function normalizeContactSheet(sheet, index) {
  const colsPerRow = normalizeCols(sheet.colsPerRow);
  const frames = (sheet.frames || [])
    .filter(f => f?.src?.trim())
    .map(normalizeContactFrame);

  return {
    id: sheet.id || ('sheet-' + Date.now() + index),
    title: sheet.title || sheet.label || '',
    filmStock: sheet.filmStock || DEFAULT_FILM_STOCK,
    colsPerRow,
    x: typeof sheet.x === 'number' ? sheet.x : 10,
    y: typeof sheet.y === 'number' ? sheet.y : 5 + index * 42,
    width: normalizeWidthPercent(sheet.width) || DEFAULT_SHEET_WIDTH,
    rotation: normalizeRotation(sheet.rotation),
    frames
  };
}

function migrateFlatToContactSheets(items) {
  const valid = items.filter(i => i.src?.trim());
  const sheets = [];

  for (let i = 0; i < valid.length; i += DEFAULT_COLS_PER_ROW * 2) {
    const chunk = valid.slice(i, i + DEFAULT_COLS_PER_ROW * 2);
    const sheetIndex = Math.floor(i / (DEFAULT_COLS_PER_ROW * 2));
    const first = chunk[0];

    sheets.push(normalizeContactSheet({
      id: 'sheet-' + (first.id || sheetIndex),
      title: '',
      colsPerRow: DEFAULT_COLS_PER_ROW,
      x: first.x ?? (4 + (sheetIndex % 3) * 32),
      y: first.y ?? (5 + Math.floor(sheetIndex / 3) * 48),
      width: Math.max(...chunk.map(p => normalizeWidthPercent(p.width)), DEFAULT_SHEET_WIDTH),
      rotation: 0,
      frames: chunk.map(p => ({
        id: p.id,
        src: p.src,
        rotation: p.rotation
      }))
    }, sheetIndex));
  }

  return { format: 'contact-sheets', sheets };
}

function normalizeMusicData(raw) {
  if (Array.isArray(raw)) return migrateFlatToContactSheets(raw);
  if (isContactSheetFormat(raw)) {
    return {
      format: 'contact-sheets',
      sheets: raw.sheets.map(normalizeContactSheet)
    };
  }
  return { format: 'contact-sheets', sheets: [] };
}

function getContactSheets(data) {
  return normalizeMusicData(data).sheets;
}

function newContactSheet(index, partial = {}) {
  return normalizeContactSheet({
    id: 'sheet-' + Date.now(),
    title: '',
    colsPerRow: DEFAULT_COLS_PER_ROW,
    x: 8 + (index % 2) * 40,
    y: 5 + Math.floor(index / 2) * 45,
    width: DEFAULT_SHEET_WIDTH,
    frames: [],
    ...partial
  }, index);
}

function sheetGridLayout(sheet) {
  const cols = normalizeCols(sheet.colsPerRow);
  const frames = (sheet.frames || []).filter(f => f?.src?.trim());
  const rowCount = Math.max(1, Math.ceil(Math.max(frames.length, 1) / cols));
  return { cols, rowCount, frames };
}

function seededNoise(seed) {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function swapSheetFrames(sheet, slotA, slotB) {
  if (slotA === slotB) return false;
  const { cols, rowCount, frames } = sheetGridLayout(sheet);
  const total = cols * rowCount;
  const slots = Array.from({ length: total }, (_, i) => frames[i] || null);
  if (!slots[slotA]?.src?.trim()) return false;

  const tmp = slots[slotA];
  slots[slotA] = slots[slotB] || null;
  slots[slotB] = tmp;
  sheet.frames = slots.filter(f => f?.src?.trim());
  return true;
}

function addFramesToSheet(sheet, srcs, options = {}) {
  const { startSlot = null, skipExisting = true } = options;
  if (!Array.isArray(srcs) || !srcs.length) return 0;

  const existing = skipExisting
    ? new Set((sheet.frames || []).map(f => f.src).filter(Boolean))
    : new Set();

  const toAdd = srcs.filter(src => src?.trim() && !existing.has(src));
  if (!toAdd.length) return 0;

  if (!sheet.frames) sheet.frames = [];

  let slot = startSlot;
  let added = 0;

  toAdd.forEach((src, i) => {
    const frame = normalizeContactFrame(
      { id: 'f' + Date.now() + i + Math.floor(Math.random() * 1000), src, rotation: 0 },
      sheet.frames.length + i
    );

    if (typeof slot === 'number' && slot >= 0) {
      sheet.frames.splice(Math.min(slot, sheet.frames.length), 0, frame);
      slot++;
    } else {
      sheet.frames.push(frame);
    }
    added++;
  });

  return added;
}

function removeFrameAtSlot(sheet, slot) {
  const { cols, rowCount, frames } = sheetGridLayout(sheet);
  const total = cols * rowCount;
  const slots = Array.from({ length: total }, (_, i) => frames[i] || null);
  if (!slots[slot]?.src?.trim()) return false;
  slots[slot] = null;
  sheet.frames = slots.filter(f => f?.src?.trim());
  return true;
}

function sheetSeed(sheet, rowIndex) {
  return (sheet.id || 's').split('').reduce((a, c) => a + c.charCodeAt(0), 0) + rowIndex * 17;
}

function buildSprocketRow(seed, position) {
  const row = document.createElement('div');
  row.className = `sprocket-row sprocket-row--${position}`;
  const count = 20 + Math.floor(seededNoise(seed + 3) * 10);

  for (let i = 0; i < count; i++) {
    const hole = document.createElement('span');
    hole.className = 'sprocket-hole';
    const jitter = (seededNoise(seed + i * 4.17) - 0.5) * 2;
    const w = 7 + seededNoise(seed + i * 6.2) * 2;
    const h = 5.5 + seededNoise(seed + i * 7.1) * 1.2;
    hole.style.left = `calc(${(i + 0.5) * (100 / count)}% + ${jitter / 10}em)`;
    hole.style.width = (w / 10) + 'em';
    hole.style.height = (h / 10) + 'em';
    row.appendChild(hole);
  }
  return row;
}

function buildBarcodeCell(seed) {
  const wrap = document.createElement('span');
  wrap.className = 'film-barcode';
  const bars = 14 + Math.floor(seededNoise(seed + 11) * 12);

  for (let i = 0; i < bars; i++) {
    const n = seededNoise(seed + i * 1.91);
    if (n < 0.12) continue;
    const bar = document.createElement('span');
    bar.className = 'film-barcode-bar';
    bar.style.left = ((i / bars) * 100 + (n - 0.5) * 2) + '%';
    bar.style.width = ((1.4 + seededNoise(seed + i * 2.43) * 3.8) / 10) + 'em';
    bar.style.height = (45 + seededNoise(seed + i * 3.17) * 55) + '%';
    bar.style.opacity = (0.55 + n * 0.45).toFixed(2);
    wrap.appendChild(bar);
  }
  return wrap;
}

function buildFilmTopEdge(sheet, rowIndex, cols, rowStartSlot) {
  const seed = sheetSeed(sheet, rowIndex);
  const edge = document.createElement('div');
  edge.className = 'film-edge film-edge--top';
  edge.appendChild(buildSprocketRow(seed, 'top'));

  const meta = document.createElement('div');
  meta.className = 'film-meta-row film-meta-row--top';
  meta.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  for (let col = 0; col < cols; col++) {
    const cell = document.createElement('div');
    cell.className = 'film-meta-cell film-meta-cell--barcode';
    cell.appendChild(buildBarcodeCell(seed + col * 13));
    meta.appendChild(cell);
  }

  edge.appendChild(meta);
  return edge;
}

function buildFilmBottomEdge(sheet, rowIndex, cols, rowStartSlot, filmStock, options = {}) {
  const seed = sheetSeed(sheet, rowIndex) + 500;
  const edge = document.createElement('div');
  edge.className = 'film-edge film-edge--bottom';

  if (options.mode !== 'live') {
    const meta = document.createElement('div');
    meta.className = 'film-meta-row film-meta-row--bottom';
    meta.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    for (let col = 0; col < cols; col++) {
      const cell = document.createElement('div');
      cell.className = 'film-meta-cell film-meta-cell--kodak';

      const brand = document.createElement('span');
      brand.className = 'film-brand';
      brand.textContent = filmStock;

      cell.appendChild(brand);
      meta.appendChild(cell);
    }

    edge.appendChild(meta);
  }

  edge.appendChild(buildSprocketRow(seed, 'bottom'));
  return edge;
}

function buildContactFrameElement(frameData, slot, options = {}) {
  const { mode = 'live', onFrameClick } = options;
  const frame = document.createElement('div');
  frame.className = 'contact-frame' + (frameData?.src?.trim() ? '' : ' empty');
  frame.dataset.slot = slot;

  if (frameData?.src?.trim()) {
    const rotation = normalizeRotation(frameData.rotation);
    const media = document.createElement('div');
    media.className = 'frame-media';
    if (rotation) {
      media.classList.add('rotated');
      media.style.transform = `rotate(${rotation}deg)`;
    }

    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    applyFrameFocus(img, frameData);
    if (mode === 'organizer' && typeof setOrganizerPreviewImg === 'function') {
      setOrganizerPreviewImg(img, frameData.src, ORGANIZER_THUMB_FRAME);
    } else {
      img.src = mediaSrc(frameData.src);
    }
    media.appendChild(img);
    attachBrokenImageHandler(img, () => {
      media.remove();
      frame.className = 'contact-frame empty';
      if (frameData?.src && typeof options.onBrokenSrc === 'function') {
        options.onBrokenSrc(frameData.src, slot);
      }
    });
    frame.appendChild(media);

    if (mode === 'organizer') {
      attachContactFramePan(frame, media, img, frameData, slot, options);
      attachContactFrameRemove(frame, slot, options);
    } else if (options.attachLiveFrame) {
      options.attachLiveFrame(frame, frameData);
    }
  } else if (mode === 'organizer' && onFrameClick) {
    frame.addEventListener('click', (e) => {
      e.stopPropagation();
      onFrameClick(slot);
    });
  }

  return frame;
}

function attachContactFrameRemove(frameEl, slot, options) {
  frameEl.querySelector('.frame-rotate-handle')?.remove();

  const media = frameEl.querySelector('.frame-media');
  if (!media) return;
  media.querySelector('.frame-del')?.remove();

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'frame-del';
  btn.setAttribute('aria-label', 'Remove photo from sheet');
  btn.textContent = '\u00d7';
  btn.title = 'remove photo from sheet (stays in library)';
  btn.addEventListener('mousedown', (e) => e.stopPropagation());
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!options.sheet) return;
    if (options.onRemoveStart) options.onRemoveStart();
    if (!removeFrameAtSlot(options.sheet, slot)) return;
    if (options.onRemoveEnd) await options.onRemoveEnd();
  });
  media.appendChild(btn);
}

function attachContactFramePan(frameEl, mediaWrap, img, frameData, sourceSlot, options) {
  mediaWrap.classList.add('frame-media--pannable');
  mediaWrap.title = 'drag to adjust crop · drag to another photo to swap';

  mediaWrap.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.target.closest('.frame-del')) return;
    if (e.shiftKey || e.metaKey || e.ctrlKey) return;
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const startFocusX = normalizeFrameFocus(frameData.focusX);
    const startFocusY = normalizeFrameFocus(frameData.focusY);
    let dragMode = null;
    let dropTarget = null;
    let ghost = null;
    let undoPushed = false;
    let panMoved = false;

    mediaWrap.classList.add('is-panning');

    function clearDropTarget() {
      if (dropTarget) dropTarget.classList.remove('swap-drop-target');
      dropTarget = null;
    }

    function hideGhost() {
      if (ghost) {
        ghost.remove();
        ghost = null;
      }
    }

    function showGhost(ev) {
      if (!ghost) {
        ghost = document.createElement('div');
        ghost.className = 'frame-drag-ghost';
        const ghostImg = document.createElement('img');
        ghostImg.src = img.src;
        ghostImg.alt = '';
        ghost.appendChild(ghostImg);
        document.body.appendChild(ghost);
      }
      ghost.style.left = (ev.clientX + 12) + 'px';
      ghost.style.top = (ev.clientY + 12) + 'px';
    }

    function revertPan() {
      frameData.focusX = startFocusX;
      frameData.focusY = startFocusY;
      applyFrameFocus(img, frameData);
    }

    function onMove(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const targetFrame = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.contact-frame');
      const sourceSheet = frameEl.closest('.contact-sheet');
      const targetSheet = targetFrame?.closest('.contact-sheet');
      const sameSheet = targetSheet === sourceSheet;

      if (
        targetFrame &&
        targetFrame !== frameEl &&
        sameSheet &&
        !targetFrame.classList.contains('empty')
      ) {
        if (dragMode !== 'swap') {
          dragMode = 'swap';
          revertPan();
          panMoved = false;
          if (!undoPushed) {
            undoPushed = true;
            if (options.onSwapStart) options.onSwapStart();
          }
        }
        clearDropTarget();
        dropTarget = targetFrame;
        dropTarget.classList.add('swap-drop-target');
        showGhost(ev);
        mediaWrap.classList.remove('is-panning');
        mediaWrap.classList.add('is-swapping');
        return;
      }

      if (targetFrame === frameEl) {
        if (dragMode === 'swap') return;
        dragMode = 'pan';
        clearDropTarget();
        hideGhost();
        mediaWrap.classList.add('is-panning');
        mediaWrap.classList.remove('is-swapping');

        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
          if (!undoPushed) {
            undoPushed = true;
            if (options.onPanStart) options.onPanStart();
          }
          panMoved = true;
        }

        const rect = mediaWrap.getBoundingClientRect();
        const nextX = Math.max(0, Math.min(100, startFocusX - (dx / rect.width) * 100));
        const nextY = Math.max(0, Math.min(100, startFocusY - (dy / rect.height) * 100));
        frameData.focusX = Math.round(nextX);
        frameData.focusY = Math.round(nextY);
        applyFrameFocus(img, frameData);
      }
    }

    async function onUp() {
      const swapSlot = dropTarget ? parseInt(dropTarget.dataset.slot, 10) : null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      mediaWrap.classList.remove('is-panning', 'is-swapping');
      clearDropTarget();
      hideGhost();

      if (dragMode === 'swap' && swapSlot != null && swapSlot !== sourceSlot) {
        if (options.sheet && swapSheetFrames(options.sheet, sourceSlot, swapSlot)) {
          if (options.onSwapEnd) await options.onSwapEnd();
        }
      } else if (dragMode === 'pan' && panMoved && options.onPanEnd) {
        await options.onPanEnd();
      } else if (undoPushed && !panMoved && dragMode !== 'swap') {
        revertPan();
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function buildContactSheetBody(sheet, options = {}) {
  const { cols, rowCount, frames } = sheetGridLayout(sheet);
  const body = document.createElement('div');
  body.className = 'contact-sheet-body';

  for (let row = 0; row < rowCount; row++) {
    const strip = document.createElement('div');
    strip.className = 'contact-strip';
    const rowStartSlot = row * cols;

    const rowEl = document.createElement('div');
    rowEl.className = 'contact-row';
    rowEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    for (let col = 0; col < cols; col++) {
      const slot = rowStartSlot + col;
      rowEl.appendChild(buildContactFrameElement(frames[slot] || null, slot, options));
    }
    strip.appendChild(rowEl);
    body.appendChild(strip);
  }

  return body;
}

function updateSheetCaption(el, title) {
  let cap = el.querySelector('.contact-sheet-caption');
  const text = (title || '').trim();
  if (!text) {
    if (cap) cap.remove();
    return;
  }
  if (!cap) {
    cap = document.createElement('p');
    cap.className = 'contact-sheet-caption';
    el.appendChild(cap);
  }
  cap.textContent = text;
}

function buildContactSheetElement(sheet, options = {}) {
  const el = document.createElement('div');
  el.className = 'contact-sheet';
  el.dataset.id = sheet.id;

  const photoFrame = document.createElement('div');
  photoFrame.className = 'photo-frame';

  const mediaWrap = document.createElement('div');
  mediaWrap.className = 'tile-media';
  mediaWrap.appendChild(buildContactSheetBody(sheet, options));
  photoFrame.appendChild(mediaWrap);

  if (options.mode === 'organizer' && options.attachSheetControls) {
    options.attachSheetControls(el, photoFrame, mediaWrap, sheet);
  }

  el.appendChild(photoFrame);
  updateSheetCaption(el, sheet.title);
  return el;
}

function rebuildContactSheetBody(mediaWrap, sheet, options) {
  const oldBody = mediaWrap.querySelector('.contact-sheet-body');
  if (oldBody) oldBody.remove();
  mediaWrap.appendChild(buildContactSheetBody(sheet, options));
}
