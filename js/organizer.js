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
    await initGalleryPanel();
  } catch (err) {
    setStatus('connection cancelled.');
  }
});

/* ---------------- tabs ---------------- */

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
  });
});

/* ============================================================
   BOARDS PANEL — handles music.html, projects.html (the listing
   page), and every individual project-*.html page. All of these
   share the same data shape:
     { id, src, caption, x, y, width, href (only on the projects
       listing — links to that project's own page) }

   Which board you're editing is picked from the dropdown, and
   maps directly to data/<board>.json + assets/<board>/. To add a
   new project page to this list, see the comment in
   organizer.html above the <select id="board-select">.
   ============================================================ */

let boardData = [];
let currentBoard = 'music';

async function initBoardsPanel() {
  const select = document.getElementById('board-select');
  select.value = currentBoard;
  select.onchange = async () => {
    currentBoard = select.value;
    boardData = await readJSON('data', currentBoard + '.json');
    renderBoardMini();
  };

  boardData = await readJSON('data', currentBoard + '.json');
  renderBoardMini();

  document.getElementById('boards-add-btn').onclick = () =>
    document.getElementById('boards-file-input').click();

  document.getElementById('boards-file-input').onchange = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const savedName = await writeMediaFile('assets/' + currentBoard, file);
      boardData.push({
        id: 'p' + Date.now() + Math.floor(Math.random() * 1000),
        src: 'assets/' + currentBoard + '/' + savedName,
        caption: file.name.replace(/\.[^.]+$/, ''),
        x: 10 + Math.random() * 60,
        y: 10 + Math.random() * 60,
        width: 220 // starting display size in pixels — draggable slider changes this
      });
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
    const width = photo.width || 220;

    const el = document.createElement('div');
    el.className = 'mini-polaroid';
    el.style.left = photo.x + '%';
    el.style.top = photo.y + '%';
    el.style.width = width + 'px'; // real width — same number that's used on the live site

    /* ---- the actual photo preview ----
       This part is deliberately styled with NO border, card, or
       shadow, so what you see here matches music.html exactly. */
    if (photo.src) {
      if (isVideoFile(photo.src)) {
        const v = document.createElement('video');
        v.src = photo.src; v.muted = true;
        el.appendChild(v);
      } else {
        const img = document.createElement('img');
        img.src = photo.src;
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

    /* ---- size slider ----
       Sets how wide this photo displays on the real site (its
       height follows automatically to keep it in proportion).
       Range: 100px (small) to 500px (large). */
    const sizeControl = document.createElement('div');
    sizeControl.className = 'size-control';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = 100;
    slider.max = 500;
    slider.step = 10;
    slider.value = width;

    const sizeLabel = document.createElement('span');
    sizeLabel.textContent = width + 'px';

    slider.addEventListener('input', () => {
      // live-resize the preview as you drag the slider, so you can
      // see the real size before it's even saved
      el.style.width = slider.value + 'px';
      sizeLabel.textContent = slider.value + 'px';
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

/* ============================================================
   SIMPLE PHOTO GRID PANEL — for portrait.html and tour.html.
   These are plain ordered lists (no position/size), unlike the
   boards above.
   ============================================================ */

let galleryData = [];
let currentGalleryPage = 'portrait';

async function initGalleryPanel() {
  const select = document.getElementById('gallery-select');
  select.value = currentGalleryPage;
  select.onchange = async () => {
    currentGalleryPage = select.value;
    galleryData = await readJSON('data', currentGalleryPage + '.json');
    renderGalleryList();
  };
  galleryData = await readJSON('data', currentGalleryPage + '.json');
  renderGalleryList();

  document.getElementById('gallery-add-btn').onclick = () =>
    document.getElementById('gallery-file-input').click();

  document.getElementById('gallery-file-input').onchange = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const savedName = await writeMediaFile('assets/' + currentGalleryPage, file);
      galleryData.push({
        src: 'assets/' + currentGalleryPage + '/' + savedName,
        caption: file.name.replace(/\.[^.]+$/, '')
      });
    }
    e.target.value = '';
    await writeJSON('data', currentGalleryPage + '.json', galleryData);
    renderGalleryList();
    setStatus('saved \u2713');
  };
}

function renderGalleryList() {
  const list = document.getElementById('gallery-list');
  list.innerHTML = '';
  galleryData.forEach((item, idx) => {
    if (!item.src) return;
    const row = document.createElement('div');
    row.className = 'item-row';

    let thumb;
    if (isVideoFile(item.src)) {
      thumb = document.createElement('video');
      thumb.src = item.src; thumb.muted = true;
    } else {
      thumb = document.createElement('img');
      thumb.src = item.src;
    }
    thumb.className = 'thumb';
    row.appendChild(thumb);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = item.caption || '';
    input.placeholder = 'caption (optional)';
    input.addEventListener('blur', async () => {
      item.caption = input.value.trim();
      await writeJSON('data', currentGalleryPage + '.json', galleryData);
      setStatus('saved \u2713');
    });
    row.appendChild(input);

    const controls = document.createElement('div');
    controls.className = 'controls';

    const up = document.createElement('button');
    up.textContent = '\u2191';
    up.disabled = idx === 0;
    up.addEventListener('click', async () => {
      [galleryData[idx - 1], galleryData[idx]] = [galleryData[idx], galleryData[idx - 1]];
      await writeJSON('data', currentGalleryPage + '.json', galleryData);
      renderGalleryList();
      setStatus('saved \u2713');
    });

    const down = document.createElement('button');
    down.textContent = '\u2193';
    down.disabled = idx === galleryData.length - 1;
    down.addEventListener('click', async () => {
      [galleryData[idx + 1], galleryData[idx]] = [galleryData[idx], galleryData[idx + 1]];
      await writeJSON('data', currentGalleryPage + '.json', galleryData);
      renderGalleryList();
      setStatus('saved \u2713');
    });

    const del = document.createElement('button');
    del.textContent = '\u00d7';
    del.title = 'remove from page (file stays on disk)';
    del.addEventListener('click', async () => {
      galleryData.splice(idx, 1);
      await writeJSON('data', currentGalleryPage + '.json', galleryData);
      renderGalleryList();
      setStatus('saved \u2713');
    });

    controls.appendChild(up);
    controls.appendChild(down);
    controls.appendChild(del);
    row.appendChild(controls);

    list.appendChild(row);
  });
}
