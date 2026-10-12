/* Homepage filmstrip — advance cover to cover */

(function initHomeFilmstrip() {
  const root = document.getElementById('home-film');
  if (!root) return;

  const ROW_COUNT = 3;
  const ROW_SHIFTS = [0, 0.31, 0.58];

  function createFilmRows() {
    const viewport = root.querySelector('.home-film-viewport');
    let rowsWrap = viewport.querySelector('.home-film-rows');
    if (!rowsWrap) {
      rowsWrap = document.createElement('div');
      rowsWrap.className = 'home-film-rows';
      const roll = viewport.querySelector('.home-film-roll');
      viewport.insertBefore(rowsWrap, roll);
      rowsWrap.appendChild(roll);
    }
    const template = rowsWrap.querySelector('.home-film-roll');
    while (rowsWrap.querySelectorAll('.home-film-roll').length < ROW_COUNT) {
      const clone = template.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      rowsWrap.appendChild(clone);
    }
    return [...rowsWrap.querySelectorAll('.home-film-roll')].map((roll, i) => ({
      roll,
      track: roll.querySelector('.home-film-track'),
      strip: roll.querySelector('.home-film-strip'),
      sprocketTop: roll.querySelector('.home-film-sprocket--top'),
      sprocketBottom: roll.querySelector('.home-film-sprocket--bottom'),
      shift: ROW_SHIFTS[i] || 0,
      reverse: i === 1
    }));
  }

  const filmRows = createFilmRows();
  const stripEl = filmRows[0].strip;
  const rollEl = filmRows[0].roll;
  const prevBtn = root.querySelector('.home-film-transport--prev');
  const nextBtn = root.querySelector('.home-film-transport--next');
  const playPauseBtn = root.querySelector('.home-film-transport--toggle');
  const transportButtons = [prevBtn, nextBtn, playPauseBtn].filter(Boolean);
  const loadingEl = root.querySelector('.home-film-loading');

  let frames = [];
  let coverIndices = [];
  let rollPools = new Map();
  let rollCurrentSrc = new Map();
  let rollVisibility = new Map();
  let rollQueuedSrc = new Map();
  let preloadedUrls = new Set();
  let visibilityInitialized = false;
  let rollCount = 0;
  let currentRollIndex = 0;
  let currentIndex = 0;
  let animating = false;
  let frameStep = 0;
  let frameEls = [];
  let lastActiveIndex = -1;
  let lastScrubbing = false;
  let reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let isPlaying = !reduceMotion;
  const AUTO_SCROLL_INDEX_PER_SEC = 0.5;
  const MIDDLE_SCROLL_INDEX_PER_SEC = 0.3456;
  const rowTravel = [0, 0, 0];
  let autoScrollPaused = false;
  let autoScrollRaf = null;
  let lastAutoScrollTime = 0;

  function updatePlayPauseButton() {
    if (!playPauseBtn) return;
    playPauseBtn.classList.toggle('is-playing', isPlaying);
    playPauseBtn.classList.toggle('is-paused', !isPlaying);
    playPauseBtn.setAttribute('aria-label', isPlaying ? 'Pause filmstrip' : 'Play filmstrip');
  }

  function setPlaying(playing) {
    isPlaying = playing;
    if (isPlaying) resumeAutoScroll();
    else pauseAutoScroll();
    updatePlayPauseButton();
  }

  function pauseAutoScroll() {
    autoScrollPaused = true;
    stopAutoScroll();
    if (lastScrubbing) {
      filmRows.forEach(row => row.track.classList.remove('is-scrubbing'));
      lastScrubbing = false;
    }
  }

  function resumeAutoScroll() {
    autoScrollPaused = false;
    lastAutoScrollTime = performance.now();
    startAutoScroll();
  }

  function wrapScrollIndex(index) {
    const trailingCloneIndex = frameEls.length - 1;
    if (index >= trailingCloneIndex) return index - rollCount;
    if (index <= 0) return index + rollCount;
    return index;
  }

  function syncRollIndexFromPosition(index) {
    const rounded = Math.round(Math.max(1, Math.min(rollCount, index)));
    currentRollIndex = (rounded - 1 + rollCount) % rollCount;
  }

  let cachedRollWidth = 0;

  function tickAutoScroll(now) {
    autoScrollRaf = 0;
    const anyFrames = filmRows.some(row => row.frameCount);
    if (animating || reduceMotion || autoScrollPaused || !anyFrames) {
      lastAutoScrollTime = now;
      return;
    }

    const dt = Math.min(0.05, (now - (lastAutoScrollTime || now)) / 1000);
    lastAutoScrollTime = now;

    filmRows.forEach((row, i) => {
      if (!row.frameCount) return;
      const rate = row.reverse
        ? MIDDLE_SCROLL_INDEX_PER_SEC
        : AUTO_SCROLL_INDEX_PER_SEC;
      rowTravel[i] += rate * dt;
      if (rowTravel[i] >= row.frameCount) rowTravel[i] -= row.frameCount;
    });

    if (autoScrollPaused) return;
    setStripPosition(currentIndex, { scrubbing: true });
    autoScrollRaf = requestAnimationFrame(tickAutoScroll);
  }

  function startAutoScroll() {
    if (reduceMotion || autoScrollRaf || autoScrollPaused) return;
    lastAutoScrollTime = performance.now();
    autoScrollRaf = requestAnimationFrame(tickAutoScroll);
  }

  function stopAutoScroll() {
    if (autoScrollRaf) cancelAnimationFrame(autoScrollRaf);
    autoScrollRaf = null;
  }

  function easeAdvance(t) {
    if (t >= 1) return 1;
    const smooth = t * t * (3 - 2 * t);
    return t * 0.62 + smooth * 0.38;
  }

  function advanceDuration(steps) {
    const n = Math.max(1, Math.abs(steps));
    return Math.min(1700, 660 + n * 290);
  }

  function seededNoise(seed) {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function buildHomeSprocketTrack(el, position, seed, frameCount) {
    el.innerHTML = '';
    el.className = 'home-film-sprocket home-film-sprocket--' + position;
    if (!frameCount) return;

    el.style.width = `calc(var(--frame-w) * ${frameCount})`;

    const holesThisFrame = window.innerWidth < 700 ? 6 : 12;
    for (let f = 0; f < frameCount; f++) {
      for (let h = 0; h < holesThisFrame; h++) {
        const hole = document.createElement('span');
        hole.className = 'home-film-sprocket-hole';
        const jitter = (seededNoise(seed + f * 5 + h * 2.3) - 0.5) * 1.5;
        const slot = (h + 0.5) / holesThisFrame;
        const w = 11 + seededNoise(seed + f + h * 1.7) * 3;
        const ht = 9 + seededNoise(seed + f * 2 + h * 1.3) * 2;
        hole.style.left = `calc(var(--frame-w) * ${f} + var(--frame-w) * ${slot} + ${jitter / 10}em)`;
        hole.style.width = (w / 10) + 'em';
        hole.style.height = (ht / 10) + 'em';
        el.appendChild(hole);
      }
    }
  }

  function syncRollScale() {
    syncHeroViewport();
    updateFrameWidth();
    filmRows.forEach((row, i) => {
      const frameCount = row.strip.querySelectorAll('.home-film-frame').length;
      buildHomeSprocketTrack(row.sprocketTop, 'top', 42 + i * 19, frameCount);
      buildHomeSprocketTrack(row.sprocketBottom, 'bottom', 84 + i * 19, frameCount);
    });
  }

  function syncRollScaleSoon() {
    syncRollScale();
    requestAnimationFrame(() => {
      syncRollScale();
      requestAnimationFrame(syncRollScale);
    });
  }

  function measureNavHeight() {
    const nav = document.querySelector('.site-nav');
    return nav ? nav.getBoundingClientRect().height : 88;
  }

  function syncHeroViewport() {
    const navH = measureNavHeight();
    root.style.setProperty('--home-nav-h', navH + 'px');
  }

  function stackChromeHeight() {
    let rowChrome = 0;
    rollEl.querySelectorAll('.home-film-sprocket').forEach(el => {
      rowChrome += el.offsetHeight;
    });
    rollEl.querySelectorAll('.home-film-edge').forEach(el => {
      const style = getComputedStyle(el);
      rowChrome += parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    });
    let chrome = rowChrome * ROW_COUNT;
    const rowsEl = root.querySelector('.home-film-rows');
    if (rowsEl) {
      const gap = parseFloat(getComputedStyle(rowsEl).rowGap) || 0;
      chrome += gap * (ROW_COUNT - 1);
    }
    const viewport = root.querySelector('.home-film-viewport');
    if (viewport) {
      const style = getComputedStyle(viewport);
      chrome += parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    }
    return chrome + 8;
  }

  function getHeroFilmBudget() {
    const hero = root.querySelector('.home-film-hero');
    const stage = root.querySelector('.home-film-stage');
    const controls = root.querySelector('.home-film-controls');
    if (!hero || !stage) return null;

    const stageStyle = getComputedStyle(stage);
    const padY =
      parseFloat(stageStyle.paddingTop) +
      parseFloat(stageStyle.paddingBottom);
    const controlsH = controls ? controls.offsetHeight : 0;
    const controlsMargin = controls
      ? parseFloat(getComputedStyle(controls).marginTop)
      : 0;

    return hero.clientHeight - controlsH - controlsMargin - padY - 8;
  }

  function framesVisibleTarget() {
    if (!rollEl?.clientWidth) return 5;

    const w = rollEl.clientWidth;
    if (w < 520) return 2.35;
    if (w < 768) return 3.15;
    if (w < 1100) return 4;
    return 5;
  }

  function updateFrameWidth() {
    if (!rollEl) return;
    const rollW = rollEl.clientWidth;
    cachedRollWidth = rollW;
    const gap = parseFloat(getComputedStyle(root).getPropertyValue('--film-frame-gap')) || 14;
    const visible = framesVisibleTarget();
    const fw = Math.max(72, (rollW - gap) / visible);

    root.style.setProperty('--frames-visible', String(visible));
    root.style.setProperty('--frame-w', fw + 'px');
    root.style.setProperty('--roll-u', (fw / 38) + 'px');
  }

  function copiesFor(count) {
    if (!count) return 0;
    const step = Math.max(72, frameStep || parseFloat(getComputedStyle(root).getPropertyValue('--frame-w')) || 200);
    const viewW = Math.max(rollEl?.clientWidth || 0, window.innerWidth || 0, 1);
    const narrow = viewW < 700;
    const wide = narrow ? viewW : Math.max(viewW, 2800);
    const visible = Math.ceil(wide / step) + 2;
    const buffer = narrow ? 1 : 4;
    return Math.min(14, Math.max(3, Math.ceil(visible / count) + buffer));
  }

  function measureFrameStep() {
    updateFrameWidth();
    const first = stripEl.querySelector('.home-film-frame');
    if (!first) {
      const style = getComputedStyle(root);
      frameStep = parseFloat(style.getPropertyValue('--frame-w')) || rollEl.clientWidth;
      return frameStep;
    }
    frameStep = first.getBoundingClientRect().width;
    return frameStep;
  }

  function centerOffsetForIndex(index) {
    const step = frameStep || measureFrameStep();
    const viewportW = cachedRollWidth || rollEl.clientWidth;
    const frameCenter = index * step + step / 2;
    return viewportW / 2 - frameCenter;
  }

  function setStripPosition(index, { scrubbing = false } = {}) {
    const step = frameStep || 0;
    filmRows.forEach((row, i) => {
      const shift = row.shift * step;
      if (!row.frameCount || !row.copies) {
        row.track.style.transform = 'translate3d(0px, 0, 0)';
        return;
      }
      const origin = row.frameCount * Math.floor(row.copies / 2);
      const travel = rowTravel[i] || 0;
      const frameIndex = row.reverse ? origin - travel : origin + travel;
      const rowX = centerOffsetForIndex(frameIndex) - shift;
      row.track.style.transform = `translate3d(${rowX}px, 0, 0)`;
      if (scrubbing !== lastScrubbing) {
        row.track.classList.toggle('is-scrubbing', scrubbing);
      }
    });
    if (scrubbing !== lastScrubbing) lastScrubbing = scrubbing;

    if (!scrubbing) {
      const rounded = Math.round(index);
      if (rounded !== lastActiveIndex) {
        if (lastActiveIndex >= 0 && frameEls[lastActiveIndex]) {
          frameEls[lastActiveIndex].classList.remove('is-active');
        }
        if (frameEls[rounded] && coverIndices.includes(rounded)) {
          frameEls[rounded].classList.add('is-active');
        }
        lastActiveIndex = rounded;
      }
    }

    updateCoverVisibility();
  }

  function resetStripMotionState() {
    lastActiveIndex = -1;
    lastScrubbing = false;
    filmRows.forEach(row => row.track.classList.remove('is-scrubbing'));
  }

  function buildFrameEl(frame, index, { eager = false } = {}) {
    const frameEl = document.createElement('div');
    frameEl.className = 'home-film-frame is-cover';
    frameEl.dataset.index = index;
    frameEl.dataset.rollId = frame.rollId || '';

    const photo = document.createElement('div');
    photo.className = 'home-film-photo';
    const img = document.createElement('img');
    img.alt = '';
    setMediaPreviewImg(img, frame.src);
    img.loading = eager ? 'eager' : 'lazy';
    if (eager) img.fetchPriority = 'high';
    img.decoding = 'async';
    photo.appendChild(img);

    frameEl.appendChild(photo);
    return frameEl;
  }

  function getRollFrameEls(rollId) {
    return frameEls.filter(el => el.dataset.rollId === rollId);
  }

  function setRollCoverSrc(rollId, src) {
    if (!rollId || !src) return;
    rollCurrentSrc.set(rollId, src);
    const frame = frames.find(f => f.rollId === rollId);
    if (frame) frame.src = src;

    getRollFrameEls(rollId).forEach(el => {
      const img = el.querySelector('img');
      if (!img) return;
      if (img.dataset.previewSrc === src) return;
      delete img.dataset.previewFallback;
      setMediaPreviewImg(img, src);
      if (img.decode) img.decode().catch(() => {});
    });
  }

  function rollIdAt(rollIndex) {
    return frames[rollIndex]?.rollId || '';
  }

  function preloadSrc(src) {
    const url = (typeof mediaPreviewSrc === 'function' && mediaPreviewSrc(src)) || mediaSrc(src);
    if (!src || !url || preloadedUrls.has(url)) return Promise.resolve();
    preloadedUrls.add(url);
    return new Promise((resolve) => {
      const img = new Image();
      const finish = () => resolve();
      img.onload = finish;
      img.onerror = finish;
      img.src = url;
    });
  }

  function queueRollCover(rollId) {
    const pool = rollPools.get(rollId);
    if (!pool?.length) return;
    const exclude = rollQueuedSrc.get(rollId) || rollCurrentSrc.get(rollId);
    const nextSrc = pickRandomCover(pool, exclude);
    if (!nextSrc) return;
    rollQueuedSrc.set(rollId, nextSrc);
    preloadSrc(nextSrc);
  }

  function warmScrollCovers(nextRoll, prevRoll) {
    [nextRoll, prevRoll].forEach(rollIndex => {
      const rollId = rollIdAt(rollIndex);
      if (!rollId) return;
      if (!rollQueuedSrc.has(rollId)) queueRollCover(rollId);
      const src = rollQueuedSrc.get(rollId);
      if (src) preloadSrc(src);
    });
  }

  function preloadAllQueuedCovers() {
    rollPools.forEach((_, rollId) => {
      if (!rollQueuedSrc.has(rollId)) queueRollCover(rollId);
      const src = rollQueuedSrc.get(rollId);
      if (src) preloadSrc(src);
    });
  }

  function applyQueuedCover(rollId) {
    if (!rollQueuedSrc.has(rollId)) queueRollCover(rollId);
    const queued = rollQueuedSrc.get(rollId);
    if (!queued) return;
    rollQueuedSrc.delete(rollId);
    setRollCoverSrc(rollId, queued);
    queueRollCover(rollId);
  }

  function isRollInViewport(rollId) {
    if (!rollEl) return false;
    const viewport = rollEl.getBoundingClientRect();
    return getRollFrameEls(rollId).some(el => {
      const rect = el.getBoundingClientRect();
      return rect.right > viewport.left && rect.left < viewport.right;
    });
  }

  function isRollCompletelyOffScreen(rollId) {
    if (!rollEl) return false;
    const viewport = rollEl.getBoundingClientRect();
    const els = getRollFrameEls(rollId);
    if (!els.length) return false;
    return els.every(el => {
      const rect = el.getBoundingClientRect();
      return rect.right <= viewport.left || rect.left >= viewport.right;
    });
  }

  function updateCoverVisibility() {
    // Every selected photo is already its own frame, so covers stay fixed.
  }

  function decodeCoverImages() {
    const imgs = stripEl.querySelectorAll('.home-film-frame img');
    return Promise.all([...imgs].map((img) => {
      if (img.complete && img.naturalWidth > 0) {
        return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
      }
      return new Promise((resolve) => {
        const finish = () => {
          if (img.decode) img.decode().then(resolve).catch(resolve);
          else resolve();
        };
        img.addEventListener('load', finish, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    }));
  }

  function snapToCover(rollIndex) {
    currentRollIndex = rollIndex;
    currentIndex = coverIndices[rollIndex];
    setStripPosition(currentIndex);
  }

  function finishAdvance(nextRoll, toIndex, { snap = false } = {}) {
    currentRollIndex = nextRoll;
    currentIndex = toIndex;
    animating = false;

    resetStripMotionState();
    if (snap) filmRows.forEach(row => { row.track.style.transition = 'none'; });
    setStripPosition(currentIndex);
    if (snap) {
      requestAnimationFrame(() => {
        filmRows.forEach(row => { row.track.style.transition = ''; });
      });
    }
    preloadAllQueuedCovers();
    if (isPlaying) resumeAutoScroll();
  }

  function runAdvanceAnimation(fromIndex, toIndex, onComplete) {
    measureFrameStep();
    const frameCount = toIndex - fromIndex;
    const duration = advanceDuration(frameCount);
    const start = performance.now();

    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const pos = fromIndex + easeAdvance(t) * frameCount;
      setStripPosition(pos, { scrubbing: t > 0.01 && t < 0.99 });

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        onComplete();
      }
    }

    requestAnimationFrame(tick);
  }

  function animateStep(direction) {
    if (animating || !direction || !rollCount) return;
    pauseAutoScroll();

    const leadingCloneIndex = 0;
    const trailingCloneIndex = frameEls.length - 1;
    const prevRoll = (currentRollIndex - 1 + rollCount) % rollCount;
    const nextRoll = (currentRollIndex + 1) % rollCount;

    let targetRoll;
    let targetIndex;
    let loopSnap = null;

    if (direction > 0) {
      targetRoll = nextRoll;
      targetIndex = coverIndices[targetRoll];
      if (currentRollIndex === rollCount - 1) {
        targetIndex = trailingCloneIndex;
        loopSnap = { roll: 0, index: coverIndices[0] };
      }
    } else {
      targetRoll = prevRoll;
      targetIndex = coverIndices[targetRoll];
      if (currentRollIndex === 0) {
        targetIndex = leadingCloneIndex;
        loopSnap = { roll: rollCount - 1, index: coverIndices[rollCount - 1] };
      }
    }

    animating = true;
    warmScrollCovers(nextRoll, prevRoll);

    try {
      if (reduceMotion) {
        finishAdvance(loopSnap ? loopSnap.roll : targetRoll, loopSnap ? loopSnap.index : targetIndex);
        return;
      }

      runAdvanceAnimation(currentIndex, targetIndex, () => {
        if (loopSnap) {
          finishAdvance(loopSnap.roll, loopSnap.index, { snap: true });
        } else {
          finishAdvance(targetRoll, targetIndex);
        }
      });
    } catch (err) {
      console.error(err);
      finishAdvance(loopSnap ? loopSnap.roll : targetRoll, loopSnap ? loopSnap.index : targetIndex);
    }
  }

  function applyHomeHero(src) {
    const photo = document.querySelector('.home-hero-photo');
    if (!photo) return;
    if (!src) {
      photo.removeAttribute('src');
      photo.hidden = true;
      return;
    }
    photo.hidden = false;
    photo.src = src;
  }

  function applyHomeGalleries(srcs) {
    document.querySelectorAll('.home-gallery-photo').forEach(img => {
      const src = srcs && srcs[img.dataset.gallery];
      if (!src) {
        img.removeAttribute('src');
        img.hidden = true;
        return;
      }
      img.hidden = false;
      img.src = src;
    });
  }

  async function boot() {
    try {
      const data = await loadHomeFilmstripData();
      applyHomeHero(data.heroSrc);
      applyHomeGalleries(data.gallerySrcs);
      frames = data.frames;
      coverIndices = data.coverIndices;
      rollCount = coverIndices.length;
      rollPools = new Map((data.rolls || []).map(roll => [roll.id, roll.coverPoolSrcs || []]));
      rollCurrentSrc = new Map(data.frames.map(frame => [frame.rollId, frame.src]));
      rollVisibility = new Map();
      visibilityInitialized = false;

      if (!(data.reelRows || []).some(list => list?.length)) {
        loadingEl.textContent = 'no photos yet — add some in the organizer';
        if (typeof window.amyMarkPageReady === 'function') window.amyMarkPageReady({ empty: true });
        return;
      }

      loadingEl.textContent = 'loading film…';
      transportButtons.forEach(btn => { btn.disabled = true; });

      measureFrameStep();

      const fillStrip = (strip, rowFrames, copies) => {
        strip.innerHTML = '';
        const origin = rowFrames.length * Math.floor(copies / 2);
        const visible = Math.ceil((rollEl.clientWidth || window.innerWidth) / (frameStep || 200)) + 3;
        for (let copy = 0; copy < copies; copy++) {
          rowFrames.forEach((frame, i) => {
            const index = copy * rowFrames.length + i;
            const eager = Math.abs(index - origin) <= visible;
            strip.appendChild(buildFrameEl(frame, index, { eager }));
            if (eager) preloadSrc(frame.src);
          });
        }
      };

      const reelRows = data.reelRows || [];
      filmRows.forEach((row, i) => {
        const rowFrames = reelRows[i] || [];
        row.frames = rowFrames;
        row.frameCount = rowFrames.length;
        row.copies = copiesFor(rowFrames.length);
        if (!rowFrames.length) {
          row.strip.innerHTML = '';
          return;
        }
        fillStrip(row.strip, rowFrames, row.copies);
        if (i > 0) row.strip.removeAttribute('aria-live');
      });

      coverIndices = coverIndices.map(i => i + 1);
      frameEls = [...stripEl.querySelectorAll('.home-film-frame')];
      resetStripMotionState();

      measureFrameStep();
      syncRollScaleSoon();
      if (rollCount) snapToCover(0);
      else setStripPosition(1);
      preloadAllQueuedCovers();

      loadingEl.hidden = true;
      if (prevBtn) prevBtn.disabled = !rollCount;
      if (nextBtn) nextBtn.disabled = !rollCount;
      if (playPauseBtn) playPauseBtn.disabled = false;

      if (reduceMotion) {
        isPlaying = false;
        pauseAutoScroll();
      }
      updatePlayPauseButton();

      let resizeTimer;
      let lastResizeW = window.innerWidth;
      const onResize = () => {
        // Phone browsers fire resize when the address bar shows or hides.
        // Rebuilding the filmstrip then freezes the scroll.
        if (window.innerWidth === lastResizeW) return;
        lastResizeW = window.innerWidth;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          measureFrameStep();
          filmRows.forEach(row => {
            if (!row.frames?.length) return;
            const need = copiesFor(row.frames.length);
            if (need !== row.copies) {
              row.copies = need;
              fillStrip(row.strip, row.frames, need);
            }
          });
          frameEls = [...stripEl.querySelectorAll('.home-film-frame')];
          syncRollScale();
          setStripPosition(currentIndex);
        }, 80);
      };
      window.addEventListener('resize', onResize);

      decodeCoverImages().then(() => syncRollScaleSoon());
      if (isPlaying) startAutoScroll();
    } catch (err) {
      console.error(err);
      loadingEl.textContent = 'could not load filmstrip';
      transportButtons.forEach(btn => { btn.disabled = frames.length === 0; });
      if (typeof window.amyMarkPageReady === 'function') window.amyMarkPageReady({ empty: true });
    }
  }

  boot();
  syncHeroViewport();
  window.addEventListener('orientationchange', syncRollScaleSoon);
})();
