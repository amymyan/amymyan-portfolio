/* ============================================================
   PRIVATE ORGANIZER TOOL
   ============================================================
   Uses the File System Access API (Chrome/Edge only) to read and
   write files directly in your project folder — that's what makes
   "choose project folder" below work, and why this only runs on
   your own computer, not for random visitors.
   ============================================================ */

let rootHandle = null;
const statusEl = document.getElementById('status');
const miniSelection = createTileSelection('mini-polaroid');

function setStatus(msg) { statusEl.textContent = msg; }

/* Walks down into a folder path (creating folders along the way
   if create:true), starting from your chosen project folder. */
async function getDir(path, { create = false } = {}) {
  let handle = rootHandle;
  for (const part of path.split('/').filter(Boolean)) {
    handle = await handle.getDirectoryHandle(part, { create });
  }
  return handle;
}

async function readJSON(dirPath, filename) {
  try {
    const dir = await getDir(dirPath);
    const fileHandle = await dir.getFileHandle(filename);
    const file = await fileHandle.getFile();
    return JSON.parse(await file.text());
  } catch {
    return [];
  }
}

async function writeJSON(dirPath, filename, data) {
  const dir = await getDir(dirPath, { create: true });
  const fileHandle = await dir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

async function writeMediaFile(dirPath, file) {
  const dir = await getDir(dirPath, { create: true });
  let filename = file.name;
  try {
    await dir.getFileHandle(filename); // already exists?
    filename = `${Date.now()}-${filename}`; // avoid overwriting it
  } catch { /* doesn't exist yet, fine to use the original name */ }

  const fileHandle = await dir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(file);
  await writable.close();
  return filename;
}

function isVideoFile(name) {
  return /\.(mp4|webm|mov)$/i.test(name);
}

const MEDIA_EXTENSIONS = /\.(jpe?g|png|gif|webp|heic|avif|tiff?|mp4|webm|mov)$/i;
const BROWSER_IMAGE = /\.(jpe?g|png|gif|webp|avif|heic)$/i;

function isBrowserDisplayable(name) {
  return isVideoFile(name) || BROWSER_IMAGE.test(name);
}

function filenameFromSrc(src) {
  return (src || '').split('/').pop();
}

function purgeEmptyEntries(boardData) {
  return boardData.filter(item => item.src?.trim() || item.href);
}

async function readIgnoreList(pageName) {
  const list = await readJSON('data', pageName + '.ignore.json');
  return new Set(Array.isArray(list) ? list : []);
}

async function addToIgnoreList(pageName, filename) {
  if (!filename) return;
  const ignored = await readIgnoreList(pageName);
  if (ignored.has(filename)) return;
  ignored.add(filename);
  await writeJSON('data', pageName + '.ignore.json', [...ignored].sort());
}

async function removeFromIgnoreList(pageName, filename) {
  if (!filename) return;
  const ignored = await readIgnoreList(pageName);
  if (!ignored.delete(filename)) return;
  await writeJSON('data', pageName + '.ignore.json', [...ignored].sort());
}

function captionFromFilename(filename) {
  return filename.replace(/^\d+-/, '').replace(/\.[^.]+$/, '');
}

async function listMediaFiles(pageName) {
  const dir = await getDir('assets/' + pageName, { create: true });
  const files = [];
  for await (const entry of dir.values()) {
    if (entry.kind === 'file' && MEDIA_EXTENSIONS.test(entry.name)) {
      files.push(entry.name);
    }
  }
  return files.sort();
}

function normalizeBoardEntry(item, pageName, index) {
  const src = item.src || '';
  const entry = {
    id: item.id || ('p' + Date.now() + Math.floor(Math.random() * 1000) + index),
    src,
    caption: item.caption || (src ? captionFromFilename(filenameFromSrc(src)) : ''),
    x: typeof item.x === 'number' ? item.x : 10,
    y: typeof item.y === 'number' ? item.y : 5,
    width: normalizeWidthPercent(item.width)
  };
  if (item.href) entry.href = item.href;
  if (item.poster) entry.poster = item.poster;
  return entry;
}

function newEntryAtTop(pageName, partial, index) {
  return normalizeBoardEntry({ ...partial, x: 10, y: 5 }, pageName, index);
}

function appendVideoPosterControls(editBar, photo, videoEl) {
  const row = document.createElement('div');
  row.className = 'poster-control';

  const preview = document.createElement('img');
  preview.className = 'poster-preview';
  if (photo.poster) preview.src = mediaSrc(photo.poster);
  row.appendChild(preview);

  const uploadBtn = document.createElement('button');
  uploadBtn.type = 'button';
  uploadBtn.textContent = 'upload thumb';
  uploadBtn.title = 'pick a thumbnail image — upload the same file to R2 only (not saved on your computer)';

  const thumbInput = document.createElement('input');
  thumbInput.type = 'file';
  thumbInput.accept = 'image/*';
  thumbInput.style.display = 'none';

  uploadBtn.addEventListener('mousedown', (e) => e.stopPropagation());
  uploadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    thumbInput.click();
  });

  thumbInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    pushUndoSnapshot();
    photo.poster = 'assets/' + currentBoard + '/' + file.name;
    const blobUrl = URL.createObjectURL(file);
    preview.src = blobUrl;
    if (videoEl) videoEl.poster = blobUrl;
    await saveBoardData();
    setStatus('saved \u2713 — now upload ' + file.name + ' to R2 in assets/' + currentBoard + '/');
    e.target.value = '';
  });

  row.appendChild(uploadBtn);
  row.appendChild(thumbInput);
  editBar.appendChild(row);
}

async function syncBoardFromFolder(pageName, boardData) {
  const filesOnDisk = await listMediaFiles(pageName);
  const ignored = await readIgnoreList(pageName);
  const registered = new Set(
    boardData.filter(i => i.src).map(i => filenameFromSrc(i.src))
  );

  let added = 0;
  const unsupported = [];

  for (const filename of filesOnDisk) {
    if (ignored.has(filename) || registered.has(filename)) continue;
    boardData.push(newEntryAtTop({
      src: 'assets/' + pageName + '/' + filename,
      caption: captionFromFilename(filename)
    }, pageName, boardData.length + added));
    if (!isBrowserDisplayable(filename)) unsupported.push(filename);
    added++;
  }

  boardData = purgeEmptyEntries(boardData).map((item, i) => normalizeBoardEntry(item, pageName, i));
  return { boardData, added, unsupported };
}

async function loadBoard(pageName) {
  let data = await readJSON('data', pageName + '.json');
  const purged = purgeEmptyEntries(data);
  if (JSON.stringify(data) !== JSON.stringify(purged)) {
    await writeJSON('data', pageName + '.json', purged);
    data = purged;
  }
  return data.map((item, i) => normalizeBoardEntry(item, pageName, i));
}

async function syncBoardWithFolder(pageName, boardData) {
  const { boardData: synced, added, unsupported } = await syncBoardFromFolder(pageName, [...boardData]);
  if (JSON.stringify(boardData) !== JSON.stringify(synced)) {
    await writeJSON('data', pageName + '.json', synced);
  }
  return { data: synced, added, unsupported };
}

/* ---------------- connect ---------------- */

document.getElementById('connect-btn').addEventListener('click', async () => {
  if (!window.showDirectoryPicker) {
    setStatus('your browser doesn\u2019t support this — try Chrome or Edge.');
    return;
  }
  try {
    rootHandle = await window.showDirectoryPicker();
    setStatus('connected to: ' + rootHandle.name);
    document.getElementById('app').style.display = 'block';
    await initBoardsPanel();
  } catch (err) {
    if (err && err.name === 'AbortError') {
      setStatus('connection cancelled.');
    } else {
      console.error(err);
      setStatus('error: ' + (err.message || err));
    }
  }
});

/* ============================================================
   BOARDS PANEL — all content pages (music, portrait, video,
   projects, and every project-*.html page). Each maps to
   data/<page>.json + assets/<page>/. Files in the asset folder
   are synced automatically; drag to place, slider to resize.
   ============================================================ */

let boardData = [];
let currentBoard = 'music';
const undoStacks = {};
const MAX_UNDO = 50;
let recordingUndo = true;

function pushUndoSnapshot() {
  if (!recordingUndo || !currentBoard) return;
  if (!undoStacks[currentBoard]) undoStacks[currentBoard] = [];
  const stack = undoStacks[currentBoard];
  const snapshot = JSON.stringify(boardData);
  if (stack.length && stack[stack.length - 1] === snapshot) return;
  stack.push(snapshot);
  if (stack.length > MAX_UNDO) stack.shift();
  updateUndoButton();
}

function updateUndoButton() {
  const btn = document.getElementById('boards-undo-btn');
  if (!btn) return;
  const stack = undoStacks[currentBoard] || [];
  btn.disabled = stack.length === 0;
}

async function undoBoardChange() {
  const stack = undoStacks[currentBoard];
  if (!stack || !stack.length) return;

  recordingUndo = false;
  boardData = JSON.parse(stack.pop());
  await writeJSON('data', currentBoard + '.json', boardData);
  renderBoardMini();
  setStatus('undo \u2713');
  recordingUndo = true;
  updateUndoButton();
}

async function saveBoardData() {
  await writeJSON('data', currentBoard + '.json', boardData);
}

async function loadAndSyncBoard(pageName) {
  const data = await loadBoard(pageName);
  return { data, added: 0, unsupported: [] };
}

function reportSyncStatus(added, unsupported) {
  if (added > 0 && unsupported.length > 0) {
    setStatus(`synced ${added} new file(s) — note: ${unsupported.join(', ')} won't display in browsers (convert to jpg/png)`);
  } else if (added > 0) {
    setStatus(`synced ${added} new file(s) from assets/${currentBoard}/ ✓`);
  } else if (unsupported.length > 0) {
    setStatus(`warning: ${unsupported.join(', ')} won't display in browsers (convert to jpg/png)`);
  }
}

async function initBoardsPanel() {
  const select = document.getElementById('board-select');
  select.value = currentBoard;
  select.onchange = async () => {
    currentBoard = select.value;
    const { data, added, unsupported } = await loadAndSyncBoard(currentBoard);
    boardData = data;
    reportSyncStatus(added, unsupported);
    renderBoardMini();
    updateUndoButton();
  };

  const { data, added, unsupported } = await loadAndSyncBoard(currentBoard);
  boardData = data;
  reportSyncStatus(added, unsupported);
  renderBoardMini();

  document.getElementById('boards-sync-btn').onclick = async () => {
    pushUndoSnapshot();
    const { data, added, unsupported } = await syncBoardWithFolder(currentBoard, boardData);
    boardData = data;
    reportSyncStatus(added, unsupported);
    renderBoardMini();
  };

  document.getElementById('boards-undo-btn').onclick = () => undoBoardChange();

  document.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.key !== 'z' || e.shiftKey) return;
    if (document.getElementById('app').style.display === 'none') return;
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;
    e.preventDefault();
    undoBoardChange();
  });

  document.getElementById('boards-register-btn').onclick = async () => {
    const name = prompt(
      'Enter the exact filename on R2 in assets/' + currentBoard + '/\n(e.g. DSC00205.jpg):'
    );
    if (!name || !name.trim()) return;
    const src = 'assets/' + currentBoard + '/' + name.trim();
    if (boardData.some(i => i.src === src)) {
      setStatus('already on this page — scroll the preview to find it, or pick a different file');
      return;
    }
    pushUndoSnapshot();
    boardData.push(newEntryAtTop({ src, caption: captionFromFilename(name.trim()) }, currentBoard, boardData.length));
    await removeFromIgnoreList(currentBoard, name.trim());
    await saveBoardData();
    renderBoardMini();
    setStatus('registered ' + name.trim() + ' \u2713 — commit & push data/' + currentBoard + '.json');
  };

  document.getElementById('boards-add-btn').onclick = () =>
    document.getElementById('boards-file-input').click();

  document.getElementById('boards-file-input').onchange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    pushUndoSnapshot();
    for (const file of files) {
      const savedName = await writeMediaFile('assets/' + currentBoard, file);
      await removeFromIgnoreList(currentBoard, savedName);
      boardData.push(newEntryAtTop({
        src: 'assets/' + currentBoard + '/' + savedName,
        caption: file.name.replace(/\.[^.]+$/, '')
      }, currentBoard, boardData.length));
    }
    e.target.value = '';
    await saveBoardData();
    renderBoardMini();
    setStatus('saved \u2713');
  };

  updateUndoButton();

  if (!window._organizerResizeBound) {
    window._organizerResizeBound = true;
    window.addEventListener('resize', () => {
      const board = document.getElementById('boards-mini-board');
      if (!board || !board.querySelector('.mini-polaroid')) return;
      reflowBoardTiles(board);
      fitBoardHeight(board, { minHeight: 520, padding: 80 });
    });
  }
}

function renderBoardMini() {
  const board = document.getElementById('boards-mini-board');
  board.innerHTML = '';
  miniSelection.clear(board);
  const legacy = board.dataset.coordPage !== currentBoard;
  const refit = () => fitBoardHeight(board, { minHeight: 520, padding: 80 });
  boardData.forEach(photo => {
    if (!photo.src?.trim() && !photo.href) return;
    const width = normalizeWidthPercent(photo.width);

    const el = document.createElement('div');
    el.className = 'mini-polaroid';
    el.dataset.id = photo.id;
    el.style.position = 'absolute';

    let x = photo.x;
    let y = photo.y;
    if (legacy) ({ x, y } = migrateLegacyCoords(x, y, board));
    applyTileLayout(el, board, { x, y, width });

    /* ---- the actual photo preview ----
       This part is deliberately styled with NO border, card, or
       shadow, so what you see here matches music.html exactly. */
    if (photo.src) {
      if (isVideoFile(photo.src)) {
        const v = document.createElement('video');
        v.src = mediaSrc(photo.src);
        v.muted = true;
        if (photo.poster) v.poster = mediaSrc(photo.poster);
        v.addEventListener('loadedmetadata', () => requestAnimationFrame(refit));
        v.addEventListener('error', () => el.remove());
        el.appendChild(v);
      } else {
        const img = document.createElement('img');
        img.src = mediaSrc(photo.src);
        img.addEventListener('load', () => requestAnimationFrame(refit));
        img.addEventListener('error', () => el.remove());
        el.appendChild(img);
      }
    } else {
      const frame = document.createElement('div');
      frame.className = 'frame';
      frame.textContent = 'no photo';
      el.appendChild(frame);
    }

    /* ---- edit toolbar (organizer-only — not part of the live site) ---- */
    const editBar = document.createElement('div');
    editBar.className = 'edit-bar';

    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.contentEditable = true;
    cap.textContent = photo.caption || '';
    cap.addEventListener('blur', async () => {
      const next = cap.textContent.trim();
      if (next === photo.caption) return;
      pushUndoSnapshot();
      photo.caption = next;
      await saveBoardData();
      setStatus('saved \u2713');
    });
    editBar.appendChild(cap);

    /* ---- size slider (% of page width) ---- */
    const sizeControl = document.createElement('div');
    sizeControl.className = 'size-control';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 5;
    slider.max = 95;
    slider.step = 1;
    slider.value = width;

    const sizeLabel = document.createElement('span');
    sizeLabel.textContent = width + '%';

    slider.addEventListener('input', () => {
      const w = parseInt(slider.value, 10);
      sizeLabel.textContent = w + '%';
      applyTileLayout(el, board, {
        x: parseFloat(el.dataset.x),
        y: parseFloat(el.dataset.y),
        width: w
      });
    });
    slider.addEventListener('change', async () => {
      const next = parseInt(slider.value, 10);
      if (next === photo.width) return;
      pushUndoSnapshot();
      photo.width = next;
      await saveBoardData();
      setStatus('saved \u2713');
      refit();
    });

    sizeControl.appendChild(slider);
    sizeControl.appendChild(sizeLabel);
    editBar.appendChild(sizeControl);

    if (photo.src && isVideoFile(photo.src)) {
      appendVideoPosterControls(editBar, photo, el.querySelector('video'));
    }

    /* ---- href (projects listing only) ----
       If this board is the projects listing page, show a small
       text field for which project page this cover links to. */
    if (currentBoard === 'projects') {
      const hrefRow = document.createElement('input');
      hrefRow.type = 'text';
      hrefRow.value = photo.href || '';
      hrefRow.placeholder = 'links to: project-example.html';
      hrefRow.style.cssText = 'font-size:0.55rem;padding:2px 4px;font-family:var(--mono);width:100%;box-sizing:border-box;';
      hrefRow.addEventListener('blur', async () => {
        const next = hrefRow.value.trim();
        if (next === (photo.href || '')) return;
        pushUndoSnapshot();
        photo.href = next;
        await saveBoardData();
        setStatus('saved \u2713');
      });
      editBar.appendChild(hrefRow);
    }

    el.appendChild(editBar);

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '\u00d7';
    del.title = 'remove from board (file stays on disk)';
    del.addEventListener('click', async () => {
      pushUndoSnapshot();
      const filename = filenameFromSrc(photo.src);
      if (filename) await addToIgnoreList(currentBoard, filename);
      boardData = boardData.filter(p => p.id !== photo.id);
      await saveBoardData();
      renderBoardMini();
      setStatus('removed \u2713 — won\u2019t reappear on sync');
    });
    el.appendChild(del);

    makeMiniDraggable(el, board, photo);
    board.appendChild(el);
  });
  requestAnimationFrame(refit);
  board.dataset.coordSystem = 'width';
  board.dataset.coordPage = currentBoard;

  if (legacy) {
    boardData.forEach(photo => {
      const tile = board.querySelector(`[data-id="${photo.id}"]`);
      if (!tile) return;
      photo.x = parseFloat(tile.dataset.x);
      photo.y = parseFloat(tile.dataset.y);
    });
    saveBoardData();
  }

  enableBoardMarquee(board, miniSelection, 'mini-polaroid');
}

function makeMiniDraggable(el, board, photo) {
  let startX, startY, shiftHeld, dragGroup, originLeftPx, originTopPx;

  function applyDragPositions(clientX, clientY) {
    const dx = clientX - startX;
    const dy = clientY - startY;

    const { positions, guideX, guideY } = snapDragGroup(
      dragGroup,
      originLeftPx,
      originTopPx,
      dx,
      dy,
      board,
      { clampMax: 90 }
    );

    positions.forEach(({ tile, x, y }) => {
      tile.classList.add('dragging');
      board.appendChild(tile);
      applyTileLayout(tile, board, { x, y, width: parseFloat(tile.dataset.w) });
    });
    setBoardSnapGuides(board, guideX, guideY);
    fitBoardHeight(board, { minHeight: 520, padding: 80, allowShrink: false, adjustScroll: false });
  }

  el.addEventListener('mousedown', (e) => {
    if (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.classList.contains('del') || e.target.closest('.poster-control')) return;
    e.preventDefault();
    shiftHeld = e.shiftKey;

    if (shiftHeld) {
      miniSelection.toggle(el);
    } else if (!el.classList.contains('selected')) {
      miniSelection.selectOnly(el, board);
    }

    dragGroup = miniSelection.getDragGroup(board, el);
    originLeftPx = captureOriginLeftPx(dragGroup);
    originTopPx = captureOriginTopPx(dragGroup);

    board.appendChild(el);
    startX = e.clientX;
    startY = e.clientY;
    let moved = 0;

    function move(e) {
      moved = Math.max(moved, Math.abs(e.clientX - startX), Math.abs(e.clientY - startY));

      if (moved > 6) {
        applyDragPositions(e.clientX, e.clientY);
      }
    }
    async function up(e) {
      dragGroup.forEach(tile => tile.classList.remove('dragging'));
      clearBoardSnapGuides(board);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);

      if (moved > 6) {
        applyDragPositions(e.clientX, e.clientY);
        fitBoardHeight(board, { minHeight: 520, padding: 80, allowShrink: false });

        pushUndoSnapshot();
        dragGroup.forEach(tile => {
          const item = boardData.find(p => p.id === tile.dataset.id);
          if (item) {
            item.x = parseFloat(tile.dataset.x);
            item.y = parseFloat(tile.dataset.y);
          }
        });
        await saveBoardData();
        setStatus('saved \u2713');
      }
    }
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}
