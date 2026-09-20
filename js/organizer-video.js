/* Organizer — video page preview that matches the live 2-column grid */

function updateVideoOrganizerUI() {
  const generalHint = document.getElementById('boards-general-hint');
  const addBtn = document.getElementById('boards-add-btn');
  if (addBtn && isVideoGridPage(currentBoard)) addBtn.textContent = '+ add videos';
  if (!generalHint) return;

  if (isVideoGridPage(currentBoard)) {
    generalHint.innerHTML =
      '<strong>video grid:</strong> this preview matches the live page. click a title to rename it. ' +
      'drag a thumbnail (or use <em>up / down</em>) to crop portrait clips. ' +
      '<em>upload thumb</em> sets a new still — then upload that same file to R2 in <code>assets/video/</code>. ' +
      'use the arrows to change order.<br>' +
      '<em>undo</em> or ⌘Z reverses your last change.';
  }
}

function attachVideoThumbPan(frame, photo, applyAll) {
  frame.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const startFocusX = normalizePosterFocus(photo.posterFocusX);
    const startFocusY = normalizePosterFocus(photo.posterFocusY);
    let moved = false;
    let undoPushed = false;
    frame.classList.add('is-panning');

    function onMove(ev) {
      const rect = frame.getBoundingClientRect();
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        if (!undoPushed) {
          undoPushed = true;
          pushUndoSnapshot();
        }
        moved = true;
      }
      photo.posterFocusX = normalizePosterFocus(startFocusX - (dx / rect.width) * 100);
      photo.posterFocusY = normalizePosterFocus(startFocusY - (dy / rect.height) * 100);
      applyAll();
    }

    async function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      frame.classList.remove('is-panning');
      if (!moved) return;
      await saveBoardData();
      setStatus('saved \u2713');
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function moveVideoItem(index, direction) {
  const next = index + direction;
  if (next < 0 || next >= boardData.length) return;
  pushUndoSnapshot();
  const [item] = boardData.splice(index, 1);
  boardData.splice(next, 0, item);
  saveBoardData().then(() => {
    renderVideoGridMini();
    setStatus('order saved \u2713');
  });
}

function renderVideoGridMini() {
  updateMusicOrganizerUI();
  updateVideoOrganizerUI();

  const boardHost = document.getElementById('boards-mini-board');
  if (!boardHost) return;

  boardHost.innerHTML = '';
  boardHost.className = 'mini-board video-grid-host';
  delete boardHost.dataset.coordSystem;
  delete boardHost.dataset.coordPage;

  const label = document.createElement('p');
  label.className = 'video-grid-preview-label';
  label.textContent = 'live page preview';
  boardHost.appendChild(label);

  const grid = document.createElement('div');
  grid.className = 'video-grid video-organizer-grid';
  boardHost.appendChild(grid);

  boardData.forEach((photo, index) => {
    if (!photo.src?.trim()) return;

    photo.posterFocusX = normalizePosterFocus(photo.posterFocusX);
    photo.posterFocusY = normalizePosterFocus(photo.posterFocusY);

    const figure = document.createElement('figure');
    figure.className = 'video-organizer-item';
    figure.dataset.id = photo.id;

    const player = document.createElement('div');
    player.className = 'video-player';
    player.title = 'drag to crop the thumbnail';

    let media = createPosterCropMedia(photo);
    player.appendChild(media);

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'video-btn video-btn--play';
    playBtn.tabIndex = -1;
    playBtn.setAttribute('aria-hidden', 'true');
    playBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
    player.appendChild(playBtn);
    figure.appendChild(player);

    const cap = document.createElement('figcaption');
    cap.className = 'video-caption cap';
    cap.contentEditable = true;
    cap.textContent = photo.caption || '';
    cap.title = 'click to rename';
    cap.addEventListener('mousedown', (e) => e.stopPropagation());
    cap.addEventListener('blur', async () => {
      const next = cap.textContent.trim();
      if (next === photo.caption) return;
      pushUndoSnapshot();
      photo.caption = next;
      await saveBoardData();
      setStatus('saved \u2713');
    });
    figure.appendChild(cap);

    const tools = document.createElement('div');
    tools.className = 'video-organizer-tools';

    const sliderRow = document.createElement('label');
    sliderRow.className = 'poster-crop-slider';
    sliderRow.append('up / down ');
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.value = String(photo.posterFocusY);
    sliderRow.appendChild(slider);
    tools.appendChild(sliderRow);

    function applyAll() {
      applyPosterFocus(media, photo);
      slider.value = String(photo.posterFocusY);
    }

    function refreshMedia() {
      const next = createPosterCropMedia(photo);
      media.replaceWith(next);
      media = next;
    }

    slider.addEventListener('mousedown', (e) => e.stopPropagation());
    let sliderUndo = false;
    slider.addEventListener('pointerdown', () => { sliderUndo = false; });
    slider.addEventListener('input', () => {
      if (!sliderUndo) {
        sliderUndo = true;
        pushUndoSnapshot();
      }
      photo.posterFocusY = normalizePosterFocus(slider.value);
      applyAll();
    });
    slider.addEventListener('change', async () => {
      photo.posterFocusY = normalizePosterFocus(slider.value);
      await saveBoardData();
      setStatus('saved \u2713');
    });

    attachVideoThumbPan(player, photo, applyAll);

    const cropApi = { refreshMedia, applyAll };
    appendVideoPosterControls(tools, photo, null, cropApi);

    const order = document.createElement('div');
    order.className = 'video-organizer-order';
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.textContent = '←';
    prevBtn.title = 'move earlier';
    prevBtn.disabled = index === 0;
    prevBtn.addEventListener('click', () => moveVideoItem(index, -1));
    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.textContent = '→';
    nextBtn.title = 'move later';
    nextBtn.disabled = index === boardData.length - 1;
    nextBtn.addEventListener('click', () => moveVideoItem(index, 1));
    order.appendChild(prevBtn);
    order.appendChild(nextBtn);
    tools.appendChild(order);

    figure.appendChild(tools);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.textContent = '\u00d7';
    del.title = 'remove from page';
    del.addEventListener('click', async () => {
      pushUndoSnapshot();
      const filename = filenameFromSrc(photo.src);
      if (filename) await addToIgnoreList(currentBoard, filename);
      boardData = boardData.filter(p => p.id !== photo.id);
      await saveBoardData();
      renderVideoGridMini();
      setStatus('removed \u2713');
    });
    figure.appendChild(del);

    grid.appendChild(figure);
  });
}
