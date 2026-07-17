/* Music page — contact sheet mode for organizer */

const sheetSelection = createTileSelection('contact-sheet');
let musicLibraryFiles = [];
const selectedLibrarySrcs = new Set();
let libraryLastClickIndex = -1;

function getMusicBoardData() {
  if (!isContactSheetFormat(boardData)) {
    boardData = normalizeMusicData(boardData);
  }
  return boardData;
}

function getMusicSheetsArray() {
  return getMusicBoardData().sheets;
}

async function loadMusicBoard(pageName) {
  let raw = await readJSON('data', pageName + '.json');
  const normalized = normalizeMusicData(Array.isArray(raw) ? raw : raw);
  if (Array.isArray(raw) || JSON.stringify(raw) !== JSON.stringify(normalized)) {
    await writeJSON('data', pageName + '.json', normalized);
  }
  return normalized;
}

function srcFromFilename(filename) {
  return 'assets/' + currentBoard + '/' + filename;
}

function updateMusicOrganizerUI() {
  const isMusic = isContactSheetPage(currentBoard);
  const library = document.getElementById('music-library');
  const newSheetBtn = document.getElementById('boards-new-sheet-btn');
  const createSheetBtn = document.getElementById('library-create-sheet-btn');
  const hint = document.getElementById('boards-music-hint');
  const addBtn = document.getElementById('boards-add-btn');
  const registerBtn = document.getElementById('boards-register-btn');
  const generalHint = document.getElementById('boards-general-hint');

  if (library) library.style.display = isMusic ? '' : 'none';
  if (newSheetBtn) newSheetBtn.style.display = isMusic ? '' : 'none';
  if (createSheetBtn) createSheetBtn.style.display = isMusic ? '' : 'none';
  if (hint) hint.style.display = isMusic ? '' : 'none';
  if (generalHint) generalHint.style.display = isMusic ? 'none' : '';
  if (addBtn) addBtn.textContent = isMusic ? '+ upload to library' : '+ add photos / videos';
  if (registerBtn) registerBtn.textContent = isMusic ? 'register R2 filename' : 'register R2 file';
}

function updateLibraryCreateButton() {
  const createBtn = document.getElementById('library-create-sheet-btn');
  const addBtn = document.getElementById('library-add-to-sheet-btn');
  const sheet = getSelectedContactSheet();

  if (createBtn) {
    createBtn.disabled = selectedLibrarySrcs.size === 0;
    createBtn.textContent = selectedLibrarySrcs.size
      ? `create contact sheet (${selectedLibrarySrcs.size} selected)`
      : 'create contact sheet from selected';
  }

  if (addBtn) {
    addBtn.disabled = selectedLibrarySrcs.size === 0 || !sheet;
    const label = sheet?.title?.trim() || 'selected sheet';
    addBtn.textContent = selectedLibrarySrcs.size && sheet
      ? `add ${selectedLibrarySrcs.size} to “${label}”`
      : 'add to selected sheet';
  }
}

function getSelectedContactSheet() {
  const board = document.getElementById('boards-mini-board');
  const selected = board?.querySelectorAll('.contact-sheet.selected') || [];
  if (selected.length !== 1) return null;
  const id = selected[0].dataset.id;
  return getMusicSheetsArray().find(s => s.id === id) || null;
}

function selectContactSheetById(sheetId) {
  const board = document.getElementById('boards-mini-board');
  const el = board?.querySelector(`.contact-sheet[data-id="${CSS.escape(sheetId)}"]`);
  if (el) sheetSelection.selectOnly(el, board);
  updateLibraryCreateButton();
}

async function addPhotosToSheet(sheet, srcs, { startSlot = null, mediaWrap = null, refit = null } = {}) {
  if (!sheet || !srcs.length) return 0;

  const existing = new Set((sheet.frames || []).map(f => f.src).filter(Boolean));
  const pending = srcs.filter(src => src?.trim() && !existing.has(src));
  if (!pending.length) {
    setStatus('photo(s) already on this sheet');
    return 0;
  }

  pushUndoSnapshot();
  const added = addFramesToSheet(sheet, pending, { startSlot, skipExisting: false });
  if (!added) return 0;

  pending.forEach(src => selectedLibrarySrcs.delete(src));
  await saveBoardData();

  if (mediaWrap) {
    rebuildContactSheetBody(mediaWrap, sheet, sheetBodyOptions(sheet, refit, { el: mediaWrap }));
  } else {
    renderBoardMini();
    selectContactSheetById(sheet.id);
  }

  renderMusicLibrary();
  setStatus(`added ${added} photo(s) \u2713`);
  return added;
}

async function addToSelectedSheet() {
  const sheet = getSelectedContactSheet();
  if (!sheet || !selectedLibrarySrcs.size) return;
  await addPhotosToSheet(sheet, [...selectedLibrarySrcs]);
}

async function refreshMusicLibrary() {
  if (!isContactSheetPage(currentBoard) || !rootHandle) return;
  musicLibraryFiles = await listMediaFiles(currentBoard);
  musicLibraryFiles = musicLibraryFiles.filter(f => !/\.(mp4|webm|mov)$/i.test(f));
  renderMusicLibrary();
}

function renderMusicLibrary() {
  const grid = document.getElementById('music-library-grid');
  if (!grid) return;

  grid.innerHTML = '';
  const usedSrcs = new Set(
    getMusicSheetsArray().flatMap(s => (s.frames || []).map(f => f.src))
  );

  if (!musicLibraryFiles.length) {
    grid.innerHTML = '<p class="library-empty">no photos in assets/music/ — upload or sync from folder</p>';
    updateLibraryCreateButton();
    return;
  }

  musicLibraryFiles.forEach((filename, index) => {
    const src = srcFromFilename(filename);
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'library-item';
    item.dataset.src = src;
    item.dataset.index = index;
    if (selectedLibrarySrcs.has(src)) item.classList.add('selected');
    if (usedSrcs.has(src)) item.classList.add('on-sheet');

    const img = document.createElement('img');
    img.src = mediaSrc(src);
    img.alt = filename;
    img.loading = 'lazy';
    img.decoding = 'async';
    item.appendChild(img);

    const label = document.createElement('span');
    label.className = 'library-label';
    label.textContent = filename;
    item.appendChild(label);

    item.addEventListener('click', (e) => {
      if (e.shiftKey && libraryLastClickIndex >= 0) {
        const from = Math.min(libraryLastClickIndex, index);
        const to = Math.max(libraryLastClickIndex, index);
        for (let i = from; i <= to; i++) {
          selectedLibrarySrcs.add(srcFromFilename(musicLibraryFiles[i]));
        }
      } else {
        if (selectedLibrarySrcs.has(src)) selectedLibrarySrcs.delete(src);
        else selectedLibrarySrcs.add(src);
        libraryLastClickIndex = index;
      }
      renderMusicLibrary();
    });

    grid.appendChild(item);
  });

  updateLibraryCreateButton();
}

async function createSheetFromSelection() {
  if (!selectedLibrarySrcs.size) return;

  const colsInput = document.getElementById('sheet-cols-input');
  const colsPerRow = normalizeCols(colsInput?.value || DEFAULT_COLS_PER_ROW);
  const sheets = getMusicSheetsArray();

  pushUndoSnapshot();
  const frames = [...selectedLibrarySrcs].map((src, i) =>
    normalizeContactFrame({ id: 'f' + Date.now() + i, src, rotation: 0 }, i)
  );

  sheets.push(newContactSheet(sheets.length, {
    colsPerRow,
    frames,
    x: 10,
    y: 5 + sheets.length * 8
  }));

  selectedLibrarySrcs.clear();
  await saveBoardData();
  renderBoardMini();
  setStatus('contact sheet created \u2713');
}

function sheetBodyOptions(sheet, refit, mediaWrapRef) {
  const opts = {
    mode: 'organizer',
    sheet,
    onRotateStart: () => pushUndoSnapshot(),
    onRotateEnd: async () => {
      await saveBoardData();
      setStatus('saved \u2713');
    },
    onPanStart: () => pushUndoSnapshot(),
    onPanEnd: async () => {
      await saveBoardData();
      setStatus('crop saved \u2713');
    },
    onSwapStart: () => pushUndoSnapshot(),
    onSwapEnd: async () => {
      await saveBoardData();
      const mediaWrap = mediaWrapRef?.el;
      if (mediaWrap) {
        rebuildContactSheetBody(mediaWrap, sheet, opts);
      } else {
        renderBoardMini();
      }
      setStatus('photos swapped \u2713');
    },
    onFrameClick: async (slot) => {
      if (!selectedLibrarySrcs.size) {
        setStatus('select photos in the library, then click an empty frame');
        return;
      }
      const mediaWrap = mediaWrapRef?.el;
      await addPhotosToSheet(sheet, [...selectedLibrarySrcs], {
        startSlot: slot,
        mediaWrap,
        refit
      });
    }
  };
  return opts;
}

function attachSheetEditBar(el, sheet, mediaWrap, refit) {
  const editBar = document.createElement('div');
  editBar.className = 'edit-bar';

  const titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.className = 'sheet-title';
  titleInput.placeholder = 'show name (optional)';
  titleInput.value = sheet.title || '';
  titleInput.addEventListener('mousedown', (e) => e.stopPropagation());
  titleInput.addEventListener('blur', async () => {
    const next = titleInput.value.trim();
    if (next === (sheet.title || '')) return;
    pushUndoSnapshot();
    sheet.title = next;
    updateSheetCaption(el, next);
    await saveBoardData();
    setStatus('saved \u2713');
  });
  editBar.appendChild(titleInput);

  const settingsRow = document.createElement('div');
  settingsRow.className = 'sheet-settings';

  settingsRow.appendChild(makeSheetSetting('cols', 'photos per row', sheet.colsPerRow, 1, 8, async (val) => {
    pushUndoSnapshot();
    sheet.colsPerRow = val;
    rebuildContactSheetBody(mediaWrap, sheet, sheetBodyOptions(sheet, refit, { el: mediaWrap }));
    await saveBoardData();
    setStatus('saved \u2713');
  }));

  settingsRow.appendChild(makeSheetSetting(
    'x', 'from left', Math.round(sheet.x), 0, 95,
    async (val) => {
      pushUndoSnapshot();
      sheet.x = val;
      applyTileLayout(el, el.parentElement, {
        x: val,
        y: sheet.y,
        width: sheet.width,
        rotation: sheet.rotation
      });
      await saveBoardData();
      refit();
    },
    'How far from the left edge of the page (% of board width). You can also drag the sheet.'
  ));

  settingsRow.appendChild(makeSheetSetting(
    'y', 'from top', Math.round(sheet.y), 0, 500,
    async (val) => {
      pushUndoSnapshot();
      sheet.y = val;
      applyTileLayout(el, el.parentElement, {
        x: sheet.x,
        y: val,
        width: sheet.width,
        rotation: sheet.rotation
      });
      await saveBoardData();
      refit();
    },
    'How far from the top of the page (% of board width). You can also drag the sheet.'
  ));

  editBar.appendChild(settingsRow);
  el.appendChild(editBar);
}

function makeSheetSetting(name, label, value, min, max, onChange, titleHint) {
  const wrap = document.createElement('label');
  wrap.className = 'sheet-setting';
  if (titleHint) wrap.title = titleHint;
  wrap.innerHTML = `<span>${label}</span>`;

  const input = document.createElement('input');
  input.type = 'number';
  input.min = min;
  input.max = max;
  input.value = value;
  input.addEventListener('mousedown', (e) => e.stopPropagation());
  input.addEventListener('change', async () => {
    const val = parseInt(input.value, 10);
    if (!Number.isFinite(val)) return;
    await onChange(Math.max(min, Math.min(max, val)));
  });
  wrap.appendChild(input);
  return wrap;
}

function renderContactSheetsMini() {
  const board = document.getElementById('boards-mini-board');
  board.innerHTML = '';
  sheetSelection.clear(board);
  board.classList.add('organizer');

  const refit = () => fitBoardHeight(board, { minHeight: 520, padding: 80 });
  const sheets = getMusicSheetsArray();

  refreshMusicLibrary();

  sheets.forEach(sheet => {
    const width = normalizeWidthPercent(sheet.width);
    const rotation = normalizeRotation(sheet.rotation);
    const mediaWrapRef = { el: null };
    const bodyOpts = sheetBodyOptions(sheet, refit, mediaWrapRef);

    const el = buildContactSheetElement(sheet, {
      ...bodyOpts,
      attachSheetControls: (sheetEl, photoFrame, mediaWrap, sheetData) => {
        mediaWrapRef.el = mediaWrap;

        const sizeControl = document.createElement('div');
        sizeControl.className = 'size-control';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = 15;
        slider.max = 95;
        slider.step = 1;
        slider.value = width;

        const sizeLabel = document.createElement('span');
        sizeLabel.textContent = width + '%';

        slider.addEventListener('mousedown', (e) => e.stopPropagation());
        slider.addEventListener('input', () => {
          const w = parseInt(slider.value, 10);
          sizeLabel.textContent = w + '%';
          sheetData.width = w;
          const coords = readTileCoords(sheetEl);
          applyTileLayout(sheetEl, board, { ...coords, width: w, rotation: coords.rotation });
        });
        slider.addEventListener('change', async () => {
          pushUndoSnapshot();
          sheetData.width = parseInt(slider.value, 10);
          await saveBoardData();
          setStatus('saved \u2713');
          refit();
        });

        sizeControl.appendChild(slider);
        sizeControl.appendChild(sizeLabel);
        photoFrame.insertBefore(sizeControl, photoFrame.firstChild);

        attachRotationHandle(sheetEl, mediaWrap, sheetData, board, refit);
      }
    });

    el.style.position = 'absolute';
    el.style.contain = 'layout style';
    applyTileLayout(el, board, { x: sheet.x, y: sheet.y, width, rotation });

    attachSheetEditBar(el, sheet, el.querySelector('.tile-media'), refit);

    const del = document.createElement('button');
    del.className = 'sheet-del';
    del.textContent = '\u00d7';
    del.title = 'delete contact sheet';
    del.addEventListener('mousedown', (e) => e.stopPropagation());
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this contact sheet? Photos stay in your library.')) return;
      pushUndoSnapshot();
      boardData = {
        ...getMusicBoardData(),
        sheets: getMusicSheetsArray().filter(s => s.id !== sheet.id)
      };
      await saveBoardData();
      renderBoardMini();
      setStatus('sheet deleted \u2713');
    });
    el.appendChild(del);

    makeContactSheetDraggable(el, board, sheet, refit);
    board.appendChild(el);
  });

  requestAnimationFrame(refit);
  enableBoardMarquee(board, sheetSelection, 'contact-sheet');
  updateLibraryCreateButton();
}

function makeContactSheetDraggable(el, board, sheet, refit) {
  let startX, startY, shiftHeld, dragGroup, originLeftPx, originTopPx;
  let rafId = null;
  let pendingX = null;
  let pendingY = null;

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
      { tileSelector: '.contact-sheet', clampMax: 90 }
    );

    positions.forEach(({ tile, x, y }) => {
      tile.classList.add('dragging');
      applyTileLayout(tile, board, {
        x,
        y,
        width: parseFloat(tile.dataset.w),
        rotation: parseFloat(tile.dataset.rotation) || 0
      });
    });
    setBoardSnapGuides(board, guideX, guideY);
  }

  function scheduleDrag(clientX, clientY) {
    pendingX = clientX;
    pendingY = clientY;
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (pendingX != null) applyDragPositions(pendingX, pendingY);
    });
  }

  el.addEventListener('mousedown', (e) => {
    if (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' ||
        e.target.closest('.sheet-del') ||
        e.target.closest('.rotate-handle') || e.target.closest('.frame-rotate-handle') ||
        e.target.closest('.size-control') || e.target.closest('.contact-frame')) return;
    e.preventDefault();
    shiftHeld = e.shiftKey;

    if (shiftHeld) sheetSelection.toggle(el);
    else if (!el.classList.contains('selected')) sheetSelection.selectOnly(el, board);
    updateLibraryCreateButton();

    dragGroup = sheetSelection.getDragGroup(board, el);
    originLeftPx = captureOriginLeftPx(dragGroup);
    originTopPx = captureOriginTopPx(dragGroup);

    board.classList.add('board-dragging');
    dragGroup.forEach(tile => board.appendChild(tile));

    startX = e.clientX;
    startY = e.clientY;
    let moved = 0;

    function move(ev) {
      moved = Math.max(moved, Math.abs(ev.clientX - startX), Math.abs(ev.clientY - startY));
      if (moved > 6) scheduleDrag(ev.clientX, ev.clientY);
    }

    async function up(ev) {
      if (rafId) cancelAnimationFrame(rafId);
      board.classList.remove('board-dragging');
      dragGroup.forEach(tile => tile.classList.remove('dragging'));
      clearBoardSnapGuides(board);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);

      if (moved > 6) {
        applyDragPositions(ev.clientX, ev.clientY);
        refit();

        pushUndoSnapshot();
        dragGroup.forEach(tile => {
          const item = getMusicSheetsArray().find(s => s.id === tile.dataset.id);
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

function setupMusicOrganizerHooks() {
  const newSheetBtn = document.getElementById('boards-new-sheet-btn');
  if (newSheetBtn && !newSheetBtn.dataset.bound) {
    newSheetBtn.dataset.bound = '1';
    newSheetBtn.onclick = async () => {
      pushUndoSnapshot();
      getMusicSheetsArray().push(newContactSheet(getMusicSheetsArray().length));
      await saveBoardData();
      renderBoardMini();
      setStatus('empty contact sheet \u2713 — select photos from library');
    };
  }

  const createBtn = document.getElementById('library-create-sheet-btn');
  if (createBtn && !createBtn.dataset.bound) {
    createBtn.dataset.bound = '1';
    createBtn.onclick = () => createSheetFromSelection();
  }

  const addToSheetBtn = document.getElementById('library-add-to-sheet-btn');
  if (addToSheetBtn && !addToSheetBtn.dataset.bound) {
    addToSheetBtn.dataset.bound = '1';
    addToSheetBtn.onclick = () => addToSelectedSheet();
  }

  const refreshBtn = document.getElementById('library-refresh-btn');
  if (refreshBtn && !refreshBtn.dataset.bound) {
    refreshBtn.dataset.bound = '1';
    refreshBtn.onclick = async () => {
      await refreshMusicLibrary();
      setStatus('library refreshed from assets/music/ \u2713');
    };
  }

  const clearSelBtn = document.getElementById('library-clear-btn');
  if (clearSelBtn && !clearSelBtn.dataset.bound) {
    clearSelBtn.dataset.bound = '1';
    clearSelBtn.onclick = () => {
      selectedLibrarySrcs.clear();
      renderMusicLibrary();
    };
  }

  updateMusicOrganizerUI();
}
