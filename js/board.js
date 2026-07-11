/* Polaroid board — loads photo data, renders draggable polaroids,
   and remembers where a visitor left them (per browser, via localStorage). */

const STORAGE_KEY = 'amy-music-layout-v1';

async function loadPhotos() {
  const res = await fetch('data/music.json');
  return res.json();
}

function getSavedLayout() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveLayout(layout) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}

function createPolaroid(photo, board, layout) {
  const el = document.createElement('div');
  el.className = 'polaroid';
  el.dataset.id = photo.id;

  const saved = layout[photo.id];
  const x = saved ? saved.x : photo.x;
  const y = saved ? saved.y : photo.y;
  const rot = saved ? saved.rot : photo.rot;

  el.style.left = x + '%';
  el.style.top = y + '%';
  el.style.transform = `rotate(${rot}deg)`;
  el.dataset.rot = rot;

  const frame = document.createElement('div');
  frame.className = 'frame';

  if (photo.src) {
    const isVideo = /\.(mp4|webm|mov)$/i.test(photo.src);
    if (isVideo) {
      const video = document.createElement('video');
      video.src = photo.src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = true;
      frame.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = photo.src;
      img.alt = photo.caption || '';
      frame.appendChild(img);
    }
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'add photo via organizer.html';
    frame.appendChild(placeholder);
  }

  const caption = document.createElement('div');
  caption.className = 'caption';
  caption.textContent = photo.caption || '';

  el.appendChild(frame);
  el.appendChild(caption);
  board.appendChild(el);

  makeDraggable(el, board);
}

function makeDraggable(el, board) {
  let startX, startY, originLeft, originTop;

  function toPercent(px, total) {
    return (px / total) * 100;
  }

  function onPointerDown(e) {
    e.preventDefault();
    el.classList.add('dragging');
    board.appendChild(el); // bring to front

    const boardRect = board.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    startX = point.clientX;
    startY = point.clientY;
    originLeft = parseFloat(el.style.left);
    originTop = parseFloat(el.style.top);

    function onPointerMove(e) {
      const point = e.touches ? e.touches[0] : e;
      const dx = point.clientX - startX;
      const dy = point.clientY - startY;

      let newLeft = originLeft + toPercent(dx, boardRect.width);
      let newTop = originTop + toPercent(dy, boardRect.height);

      newLeft = Math.max(-5, Math.min(95, newLeft));
      newTop = Math.max(-5, Math.min(95, newTop));

      el.style.left = newLeft + '%';
      el.style.top = newTop + '%';
    }

    function onPointerUp() {
      el.classList.remove('dragging');
      document.removeEventListener('mousemove', onPointerMove);
      document.removeEventListener('mouseup', onPointerUp);
      document.removeEventListener('touchmove', onPointerMove);
      document.removeEventListener('touchend', onPointerUp);

      const layout = getSavedLayout();
      layout[el.dataset.id] = {
        x: parseFloat(el.style.left),
        y: parseFloat(el.style.top),
        rot: parseFloat(el.dataset.rot)
      };
      saveLayout(layout);
    }

    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('touchend', onPointerUp);
  }

  el.addEventListener('mousedown', onPointerDown);
  el.addEventListener('touchstart', onPointerDown, { passive: false });
}

async function initBoard() {
  const board = document.getElementById('board');
  const photos = await loadPhotos();
  const layout = getSavedLayout();

  photos.forEach(photo => createPolaroid(photo, board, layout));

  document.getElementById('reset-layout').addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    board.innerHTML = '';
    photos.forEach(photo => createPolaroid(photo, board, {}));
  });
}

initBoard();
