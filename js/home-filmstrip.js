/* Homepage filmstrip — advance cover to cover */

(function initHomeFilmstrip() {
  const root = document.getElementById('home-film');
  if (!root) return;

  const stripEl = root.querySelector('.home-film-strip');
  const trackEl = root.querySelector('.home-film-track');
  const rollEl = root.querySelector('.home-film-roll');
  const viewportEl = root.querySelector('.home-film-viewport');
  const prevBtn = root.querySelector('.home-film-nav--prev');
  const nextBtn = root.querySelector('.home-film-nav--next');
  const navButtons = [prevBtn, nextBtn].filter(Boolean);
  const loadingEl = root.querySelector('.home-film-loading');
  const sprocketTopEl = root.querySelector('.home-film-sprocket--top');
  const sprocketBottomEl = root.querySelector('.home-film-sprocket--bottom');

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

    for (let f = 0; f < frameCount; f++) {
      const holesThisFrame = 12;
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
    updateFrameWidth();
    const first = stripEl.querySelector('.home-film-frame');
    const frameCount = stripEl.querySelectorAll('.home-film-frame').length;
    if (first) {
      root.style.setProperty('--roll-u', (first.offsetWidth / 38) + 'px');
    }
    buildHomeSprocketTrack(sprocketTopEl, 'top', 42, frameCount);
    buildHomeSprocketTrack(sprocketBottomEl, 'bottom', 84, frameCount);
  }

  function syncRollScaleSoon() {
    syncRollScale();
    requestAnimationFrame(() => {
      syncRollScale();
      requestAnimationFrame(syncRollScale);
    });
  }

  function peekPx() {
    if (!rollEl?.clientWidth) return 120;
    const w = rollEl.clientWidth;
    return Math.min(100, Math.max(38, w * 0.12));
  }

  function updateFrameWidth() {
    if (!rollEl) return;
    const fw = Math.max(200, rollEl.clientWidth - peekPx() * 2);
    root.style.setProperty('--frame-w', fw + 'px');
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
    const viewportW = rollEl.clientWidth;
    const frameCenter = index * step + step / 2;
    return viewportW / 2 - frameCenter;
  }

  function setStripPosition(index, { scrubbing = false } = {}) {
    const x = centerOffsetForIndex(index);
    trackEl.style.transform = `translate3d(${x}px, 0, 0)`;

    if (scrubbing !== lastScrubbing) {
      trackEl.classList.toggle('is-scrubbing', scrubbing);
      lastScrubbing = scrubbing;
    }

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
    trackEl.classList.remove('is-scrubbing');
  }

  function buildFrameEl(frame, index, { eager = false } = {}) {
    const frameEl = document.createElement('div');
    frameEl.className = 'home-film-frame is-cover';
    frameEl.dataset.index = index;
    frameEl.dataset.rollId = frame.rollId || '';

    const photo = document.createElement('div');
    photo.className = 'home-film-photo';
    const img = document.createElement('img');
    img.alt = frame.title || '';
    img.src = mediaSrc(frame.src);
    img.loading = eager ? 'eager' : 'lazy';
    if (eager) img.fetchPriority = 'high';
    img.decoding = 'async';
    photo.appendChild(img);

    const link = document.createElement('a');
    link.className = 'home-film-cover-link';
    link.href = frame.href;
    link.innerHTML = '<span class="home-film-cover-title">' + frame.title + '</span>';
    photo.appendChild(link);

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
      const next = mediaSrc(src);
      if (img.getAttribute('src') === next) return;
      img.src = next;
      if (img.decode) img.decode().catch(() => {});
    });
  }

  function rollIdAt(rollIndex) {
    return frames[rollIndex]?.rollId || '';
  }

  function preloadSrc(src) {
    const url = mediaSrc(src);
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

  function updateCoverVisibility() {
    if (!rollEl || !frameEls.length) return;

    rollPools.forEach((_, rollId) => {
      const isVisible = isRollInViewport(rollId);
      const wasVisible = rollVisibility.get(rollId) ?? false;
      if (!visibilityInitialized) {
        rollVisibility.set(rollId, isVisible);
        return;
      }
      if (wasVisible && !isVisible) applyQueuedCover(rollId);
      rollVisibility.set(rollId, isVisible);
    });

    visibilityInitialized = true;
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
    if (snap) trackEl.style.transition = 'none';
    setStripPosition(currentIndex);
    if (snap) {
      requestAnimationFrame(() => {
        trackEl.style.transition = '';
      });
    }
    preloadAllQueuedCovers();
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
    if (animating || !direction) return;

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

  async function boot() {
    try {
      const data = await loadHomeFilmstripData();
      frames = data.frames;
      coverIndices = data.coverIndices;
      rollCount = coverIndices.length;
      rollPools = new Map((data.rolls || []).map(roll => [roll.id, roll.coverPoolSrcs || []]));
      rollCurrentSrc = new Map(data.frames.map(frame => [frame.rollId, frame.src]));
      rollVisibility = new Map();
      visibilityInitialized = false;

      if (!frames.length) {
        loadingEl.textContent = 'no photos yet — add some in the organizer';
        return;
      }

      loadingEl.textContent = 'loading film…';
      navButtons.forEach(btn => { btn.disabled = true; });

      updateFrameWidth();
      stripEl.innerHTML = '';

      const leadingClone = buildFrameEl(frames[frames.length - 1], 0);
      leadingClone.classList.add('home-film-frame--loop-clone');
      leadingClone.setAttribute('aria-hidden', 'true');
      stripEl.appendChild(leadingClone);

      frames.forEach((frame, i) => {
        stripEl.appendChild(buildFrameEl(frame, i + 1, { eager: true }));
        preloadSrc(frame.src);
      });

      const trailingClone = buildFrameEl(frames[0], frames.length + 1);
      trailingClone.classList.add('home-film-frame--loop-clone');
      trailingClone.setAttribute('aria-hidden', 'true');
      stripEl.appendChild(trailingClone);

      coverIndices = coverIndices.map(i => i + 1);
      frameEls = [...stripEl.querySelectorAll('.home-film-frame')];
      resetStripMotionState();

      measureFrameStep();
      syncRollScaleSoon();
      snapToCover(0);
      preloadAllQueuedCovers();

      loadingEl.hidden = true;
      navButtons.forEach(btn => { btn.disabled = false; });

      prevBtn?.addEventListener('click', () => animateStep(-1));
      nextBtn?.addEventListener('click', () => animateStep(1));

      document.addEventListener('keydown', (e) => {
        if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
        if (e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault();
          animateStep(1);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          animateStep(-1);
        }
      });

      let resizeTimer;
      const onResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          measureFrameStep();
          syncRollScaleSoon();
          setStripPosition(currentIndex);
        }, 80);
      };
      window.addEventListener('resize', onResize);
      if (window.ResizeObserver) {
        const ro = new ResizeObserver(onResize);
        ro.observe(rollEl);
      }

      decodeCoverImages().then(() => syncRollScaleSoon());
    } catch (err) {
      console.error(err);
      loadingEl.textContent = 'could not load filmstrip';
      navButtons.forEach(btn => { btn.disabled = frames.length === 0; });
    }
  }

  boot();
})();
