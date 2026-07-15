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
  return src.split('/').pop();
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
    x: typeof item.x === 'number' ? item.x : 10 + (index % 4) * 18,
    y: typeof item.y === 'number' ? item.y : 10 + Math.floor(index / 4) * 15,
    width: normalizeWidthPercent(item.width)
  };
  if (item.href) entry.href = item.href;
  return entry;
}

async function syncBoardFromFolder(pageName, boardData) {
  const filesOnDisk = await listMediaFiles(pageName);
  const registered = new Set(
    boardData.filter(i => i.src).map(i => filenameFromSrc(i.src))
  );

  let added = 0;
  const unsupported = [];

  for (const filename of filesOnDisk) {
    if (!registered.has(filename)) {
      boardData.push(normalizeBoardEntry({
        src: 'assets/' + pageName + '/' + filename,
        caption: captionFromFilename(filename)
      }, pageName, boardData.length + added));
      if (!isBrowserDisplayable(filename)) unsupported.push(filename);
      added++;
    }
  }

  boardData = boardData.map((item, i) => normalizeBoardEntry(item, pageName, i));
  return { boardData, added, unsupported };
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
   BOARDS PANEL — all content pages (music, portrait, tour,
   projects, and every project-*.html page). Each maps to
   data/<page>.json + assets/<page>/. Files in the asset folder
   are synced automatically; drag to place, slider to resize.
   ============================================================ */

let boardData = [];
let currentBoard = 'music';

async function loadAndSyncBoard(pageName) {
  const data = await readJSON('data', pageName + '.json');
  const { boardData: synced, added, unsupported } = await syncBoardFromFolder(pageName, data);
  if (JSON.stringify(data) !== JSON.stringify(synced)) {
    await writeJSON('data', pageName + '.json', synced);
  }
  return { data: synced, added, unsupported };
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
  };

  const { data, added, unsupported } = await loadAndSyncBoard(currentBoard);
  boardData = data;
  reportSyncStatus(added, unsupported);
  renderBoardMini();

  document.getElementById('boards-sync-btn').onclick = async () => {
    const { data, added, unsupported } = await loadAndSyncBoard(currentBoard);
    boardData = data;
    reportSyncStatus(added, unsupported);
    renderBoardMini();
  };

  document.getElementById('boards-add-btn').onclick = () =>
    document.getElementById('boards-file-input').click();

  document.getElementById('boards-file-input').onchange = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const savedName = await writeMediaFile('assets/' + currentBoard, file);
      boardData.push(normalizeBoardEntry({
        src: 'assets/' + currentBoard + '/' + savedName,
        caption: file.name.replace(/\.[^.]+$/, '')
      }, currentBoard, boardData.length));
    }
    e.target.value = '';
    await writeJSON('data', currentBoard + '.json', boardData);
    renderBoardMini();
    setStatus('saved \u2713');
  };
}

function renderBoardMini() {
  const board = document.getElementById('boards-mini-board');
  board.innerHTML = '';
  boardData.forEach(photo => {
    const width = normalizeWidthPercent(photo.width);

    const el = document.createElement('div');
    el.className = 'mini-polaroid';
    el.style.left = photo.x + '%';
    el.style.top = photo.y + '%';
    el.style.width = width + '%';

    /* ---- the actual photo preview ----
       This part is deliberately styled with NO border, card, or
       shadow, so what you see here matches music.html exactly. */
    if (photo.src) {
      if (isVideoFile(photo.src)) {
        const v = document.createElement('video');
        v.src = mediaSrc(photo.src); v.muted = true;
        el.appendChild(v);
      } else {
        const img = document.createElement('img');
        img.src = mediaSrc(photo.src);
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
      photo.caption = cap.textContent.trim();
      await writeJSON('data', currentBoard + '.json', boardData);
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
      el.style.width = slider.value + '%';
      sizeLabel.textContent = slider.value + '%';
    });
    slider.addEventListener('change', async () => {
      photo.width = parseInt(slider.value, 10);
      await writeJSON('data', currentBoard + '.json', boardData);
      setStatus('saved \u2713');
    });

    sizeControl.appendChild(slider);
    sizeControl.appendChild(sizeLabel);
    editBar.appendChild(sizeControl);

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
        photo.href = hrefRow.value.trim();
        await writeJSON('data', currentBoard + '.json', boardData);
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
      boardData = boardData.filter(p => p.id !== photo.id);
      await writeJSON('data', currentBoard + '.json', boardData);
      renderBoardMini();
      setStatus('saved \u2713');
    });
    el.appendChild(del);

    makeMiniDraggable(el, board, photo);
    board.appendChild(el);
  });
}

function makeMiniDraggable(el, board, photo) {
  let startX, startY, originLeft, originTop;

  el.addEventListener('mousedown', (e) => {
    if (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.classList.contains('del')) return;
    e.preventDefault();
    el.classList.add('dragging');
    board.appendChild(el);
    const rect = board.getBoundingClientRect();
    startX = e.clientX; startY = e.clientY;
    originLeft = parseFloat(el.style.left);
    originTop = parseFloat(el.style.top);

    function move(e) {
      const dx = ((e.clientX - startX) / rect.width) * 100;
      const dy = ((e.clientY - startY) / rect.height) * 100;
      const newLeft = Math.max(-5, Math.min(90, originLeft + dx));
      const newTop = Math.max(-5, Math.min(85, originTop + dy));
      el.style.left = newLeft + '%';
      el.style.top = newTop + '%';
    }
    async function up() {
      el.classList.remove('dragging');
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      photo.x = parseFloat(el.style.left);
      photo.y = parseFloat(el.style.top);
      await writeJSON('data', currentBoard + '.json', boardData);
      setStatus('saved \u2713');
    }
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}
