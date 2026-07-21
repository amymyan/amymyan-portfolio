/* Organizer — portrait 2-column grid with drag reorder */

const PORTRAIT_DRAG_THRESHOLD = 6;

function isPortraitGridPage(pageName) {
  return pageName === 'portrait';
}

function normalizePortraitBoardData(raw) {
  if (Array.isArray(raw)) {
    return raw
      .filter(item => item?.src?.trim())
      .map((item, i) => normalizePortraitEntry(item, i));
  }

  /* Recover if portrait.json was mistakenly saved as contact-sheets (music format). */
  if (typeof isContactSheetFormat === 'function' && isContactSheetFormat(raw)) {
    const items = [];
    for (const sheet of raw.sheets || []) {
      for (const frame of sheet.frames || []) {
        const src = (frame?.src || '').trim();
        if (!src || !src.includes('/portrait/')) continue;
        items.push(normalizePortraitEntry(frame, items.length));
      }
    }
    return items;
  }

  return [];
}

async function loadPortraitBoard(pageName) {
  const raw = await readJSON('data', pageName + '.json');
  const normalized = normalizePortraitBoardData(raw);
  if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
    await writeJSON('data', pageName + '.json', normalized);
  }
  return normalized;
}

function normalizePortraitEntry(item, index) {
  const src = item?.src || '';
  return {
    id: item?.id || ('p' + Date.now() + Math.floor(Math.random() * 1000) + index),
    src,
    caption: item?.caption || (src ? captionFromFilename(filenameFromSrc(src)) : '')
  };
}

function updatePortraitOrganizerUI() {
  const generalHint = document.getElementById('boards-general-hint');
  if (!generalHint) return;

  if (isPortraitGridPage(currentBoard)) {
    generalHint.innerHTML =
      '<strong>portrait grid:</strong> drag any photo to reorder — drop it above or below another photo in either column. ' +
      'preview matches the live page.<br>' +
      '<em>undo</em> or ⌘Z reverses your last change.';
  } else {
    resetGeneralBoardHint();
  }
}

function resetGeneralBoardHint() {
  const generalHint = document.getElementById('boards-general-hint');
  if (!generalHint) return;
  generalHint.innerHTML =
    '<strong>adding media:</strong> upload files to R2 in <code>assets/&lt;page&gt;/</code>, then click ' +
    '<em>register R2 file</em> to add them to the page. Or add locally via ' +
    '<em>sync from folder</em> only runs when you click it — removing a photo (×) keeps it off the page even if the file is still on disk or R2.<br>' +
    'drag to arrange, size slider on top of each photo, pink rotation dot above photo to spin. click a caption to edit — it shows centered under the video on the live site.<br>' +
    '<em>undo</em> button or ⌘Z (ctrl+Z on windows) reverses your last change on this page.<br>' +
    'video thumbnails: click <em>upload thumb</em>, pick an image, then upload that same file to R2 in <code>assets/&lt;page&gt;/</code> — one upload, R2 only.';
}

function syncPortraitGridOrderFromDOM(board) {
  const ids = readPortraitMasonryOrder(board, '.portrait-grid-item');
  const byId = Object.fromEntries(boardData.map(item => [item.id, item]));
  boardData = ids.map(id => byId[id]).filter(Boolean);
}

function makePortraitGridSortable(el, board) {
  let startX = 0;
  let startY = 0;
  let moved = 0;
  let undoGate = { recorded: false };
  let lastDropKey = '';

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('.del') || e.target.closest('.cap')) return;
    e.preventDefault();

    const point = e.touches ? e.touches[0] : e;
    startX = point.clientX;
    startY = point.clientY;
    moved = 0;
    undoGate = { recorded: false };
    lastDropKey = '';

    function onMove(ev) {
      ev.preventDefault();
      const p = ev.touches ? ev.touches[0] : ev;
      const dx = p.clientX - startX;
      const dy = p.clientY - startY;
      moved = Math.max(moved, Math.abs(dx), Math.abs(dy));

      if (moved <= PORTRAIT_DRAG_THRESHOLD) return;

      maybeRecordDragUndo(undoGate);
      el.classList.add('dragging');
      board.classList.add('portrait-grid-dragging');

      const target = findPortraitMasonryDropTarget(board, p.clientX, p.clientY, el);
      if (!target) return;

      const key = portraitMasonryDropKey(target);
      if (key === lastDropKey) return;
      lastDropKey = key;

      if (applyPortraitMasonryDropTarget(el, target)) {
        board.querySelectorAll('.portrait-grid-col').forEach(col => {
          col.classList.toggle('portrait-col-drop-target', col === target.col);
        });
      }
    }

    async function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      document.removeEventListener('touchcancel', onUp);

      el.classList.remove('dragging');
      board.classList.remove('portrait-grid-dragging');
      board.querySelectorAll('.portrait-grid-col').forEach(col => {
        col.classList.remove('portrait-col-drop-target');
      });

      if (moved <= PORTRAIT_DRAG_THRESHOLD) return;

      syncPortraitGridOrderFromDOM(board);
      await saveBoardData();
      renderPortraitGridMini();
      setStatus('order saved \u2713');
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
    document.addEventListener('touchcancel', onUp);
  }

  el.addEventListener('mousedown', onPointerDown);
  el.addEventListener('touchstart', onPointerDown, { passive: false });
}

function renderPortraitGridMini() {
  updateMusicOrganizerUI();
  updatePortraitOrganizerUI();

  const boardHost = document.getElementById('boards-mini-board');
  if (!boardHost) return;

  boardHost.innerHTML = '';
  boardHost.className = 'mini-board portrait-grid-host';
  delete boardHost.dataset.coordSystem;
  delete boardHost.dataset.coordPage;

  const label = document.createElement('p');
  label.className = 'portrait-grid-preview-label';
  label.textContent = 'live page preview (scaled down)';
  boardHost.appendChild(label);

  const board = document.createElement('div');
  board.className = 'portrait-grid-board';
  boardHost.appendChild(board);

  const cols = createPortraitMasonryColumns(board);
  let index = 0;

  boardData.forEach(photo => {
    if (!photo.src?.trim()) return;

    const el = document.createElement('div');
    el.className = 'portrait-grid-item';
    el.dataset.id = photo.id;

    if (isVideoFile(photo.src)) {
      const video = document.createElement('video');
      video.src = mediaSrc(photo.src);
      video.muted = true;
      if (photo.poster) video.poster = mediaSrc(photo.poster);
      el.appendChild(video);
    } else {
      const img = document.createElement('img');
      setOrganizerPreviewImg(img, photo.src, ORGANIZER_THUMB_PORTRAIT);
      attachBrokenImageHandler(img, async () => {
        el.remove();
        await purgeBrokenBoardSrc(photo.src);
      });
      el.appendChild(img);
    }

    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.contentEditable = true;
    cap.textContent = photo.caption || '';
    cap.addEventListener('mousedown', (e) => e.stopPropagation());
    cap.addEventListener('blur', async () => {
      const next = cap.textContent.trim();
      if (next === photo.caption) return;
      pushUndoSnapshot();
      photo.caption = next;
      await saveBoardData();
      setStatus('saved \u2713');
    });
    el.appendChild(cap);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.textContent = '\u00d7';
    del.title = 'remove from grid';
    del.addEventListener('mousedown', (e) => e.stopPropagation());
    del.addEventListener('click', async () => {
      pushUndoSnapshot();
      const filename = filenameFromSrc(photo.src);
      if (filename) await addToIgnoreList(currentBoard, filename);
      boardData = boardData.filter(p => p.id !== photo.id);
      await saveBoardData();
      renderPortraitGridMini();
      setStatus('removed \u2713');
    });
    el.appendChild(del);

    makePortraitGridSortable(el, board);
    cols[portraitMasonryColumnIndex(index)].appendChild(el);
    index++;
  });
}
