/* Private organizer tool.
   Uses the File System Access API (Chrome/Edge) to read+write files
   directly in your project folder. Not supported in Firefox/Safari —
   the status line will say so if it isn't available. */

let rootHandle = null;
const statusEl = document.getElementById('status');

function setStatus(msg) { statusEl.textContent = msg; }

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
  // avoid collisions by prefixing with a short timestamp if needed
  let filename = file.name;
  try {
    await dir.getFileHandle(filename); // exists?
    filename = `${Date.now()}-${filename}`;
  } catch { /* doesn't exist yet, fine */ }

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
    await initMusicPanel();
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

/* ---------------- music panel ---------------- */

let musicData = [];

async function initMusicPanel() {
  musicData = await readJSON('data', 'music.json');
  renderMusicBoard();

  document.getElementById('music-add-btn').onclick = () =>
    document.getElementById('music-file-input').click();

  document.getElementById('music-file-input').onchange = async (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const savedName = await writeMediaFile('assets/music', file);
      musicData.push({
        id: 'p' + Date.now() + Math.floor(Math.random() * 1000),
        src: 'assets/music/' + savedName,
        caption: file.name.replace(/\.[^.]+$/, ''),
        x: 10 + Math.random() * 60,
        y: 10 + Math.random() * 60,
        rot: Math.round((Math.random() * 14) - 7)
      });
    }
    e.target.value = '';
    await writeJSON('data', 'music.json', musicData);
    renderMusicBoard();
    setStatus('saved \u2713');
  };
}

function renderMusicBoard() {
  const board = document.getElementById('music-board');
  board.innerHTML = '';
  musicData.forEach(photo => {
    const el = document.createElement('div');
    el.className = 'mini-polaroid';
    el.style.left = photo.x + '%';
    el.style.top = photo.y + '%';

    const frame = document.createElement('div');
    frame.className = 'frame';
    if (isVideoFile(photo.src)) {
      const v = document.createElement('video');
      v.src = photo.src; v.muted = true;
      frame.appendChild(v);
    } else {
      const img = document.createElement('img');
      img.src = photo.src;
      frame.appendChild(img);
    }
    el.appendChild(frame);

    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.contentEditable = true;
    cap.textContent = photo.caption || '';
    cap.addEventListener('blur', async () => {
      photo.caption = cap.textContent.trim();
      await writeJSON('data', 'music.json', musicData);
      setStatus('saved \u2713');
    });
    el.appendChild(cap);

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '\u00d7';
    del.title = 'remove from board (file stays on disk)';
    del.addEventListener('click', async () => {
      musicData = musicData.filter(p => p.id !== photo.id);
      await writeJSON('data', 'music.json', musicData);
      renderMusicBoard();
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
    if (e.target.isContentEditable || e.target.classList.contains('del')) return;
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
      await writeJSON('data', 'music.json', musicData);
      setStatus('saved \u2713');
    }
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
}

/* ---------------- gallery panel ---------------- */

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
