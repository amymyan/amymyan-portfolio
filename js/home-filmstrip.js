/* Homepage filmstrip — advance, scrub, cover gate */

(function initHomeFilmstrip() {
  const root = document.getElementById('home-film');
  if (!root) return;

  const stripEl = root.querySelector('.home-film-strip');
  const trackEl = root.querySelector('.home-film-track');
  const rollEl = root.querySelector('.home-film-roll');
  const viewportEl = root.querySelector('.home-film-viewport');
  const advanceBtn = root.querySelector('.home-film-advance');
  const gateMark = root.querySelector('.home-film-gate-mark');
  const loadingEl = root.querySelector('.home-film-loading');
  const sprocketTopEl = root.querySelector('.home-film-sprocket--top');
  const sprocketBottomEl = root.querySelector('.home-film-sprocket--bottom');

  let frames = [];
  let coverIndices = [];
  let rollCount = 0;
  let currentRollIndex = 0;
  let currentIndex = 0;
  let animating = false;
  let frameStep = 0;
  let frameEls = [];
  let lastActiveIndex = -1;
  let lastScrubbing = false;
  let reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function easeScrub(t) {
    /* Smooth ease — gentle start, steady scrub, soft land on cover */
    if (t < 0.12) {
      const p = t / 0.12;
      return p * p * 0.06;
    }
    if (t < 0.82) {
      const p = (t - 0.12) / 0.7;
      const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      return 0.06 + eased * 0.86;
    }
    const p = (t - 0.82) / 0.18;
    return 0.92 + (1 - Math.pow(1 - p, 3)) * 0.08;
  }

  function scrubDurationForFrames(frameCount) {
    return Math.min(2400, 720 + frameCount * 55);
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
    const gate = root.querySelector('.home-film-gate-mark');
    if (gate && rollEl?.clientWidth) {
      return (rollEl.clientWidth - gate.offsetWidth) / 2;
    }
    return 72;
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
    frameStep = first.offsetWidth;
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

    const rounded = Math.round(index);
    if (rounded !== lastActiveIndex) {
      if (lastActiveIndex >= 0 && frameEls[lastActiveIndex]) {
        frameEls[lastActiveIndex].classList.remove('is-active');
      }
      if (frameEls[rounded] && frames[rounded]?.isCover) {
        frameEls[rounded].classList.add('is-active');
      }
      lastActiveIndex = rounded;
    }

    gateMark.classList.toggle('is-link-ready', !animating && frames[rounded]?.isCover);
  }

  function resetStripMotionState() {
    lastActiveIndex = -1;
    lastScrubbing = false;
    trackEl.classList.remove('is-scrubbing');
  }

  function buildFrameEl(frame, index) {
    const frameEl = document.createElement('div');
    frameEl.className = 'home-film-frame' + (frame.isCover ? ' is-cover' : '');
    frameEl.dataset.index = index;

    const photo = document.createElement('div');
    photo.className = 'home-film-photo';
    const img = document.createElement('img');
    img.alt = frame.isCover ? frame.title : '';

    if (frame.isCover) {
      img.src = mediaSrc(frame.src);
      img.loading = 'eager';
      img.fetchPriority = 'high';
    } else {
      img.loading = 'lazy';
      img.dataset.scrubSrc = frame.src;
      img.src = mediaSrc(frame.src);
      if (typeof HomeScrubImages !== 'undefined') {
        HomeScrubImages.resolveScrubUrl(frame.src).then((url) => {
          if (url && url !== img.src) img.src = url;
        });
      }
    }

    img.decoding = 'async';
    photo.appendChild(img);
    frameEl.appendChild(photo);

    if (frame.isCover) {
      const link = document.createElement('a');
      link.className = 'home-film-cover-link';
      link.href = frame.href;
      link.innerHTML = '<span class="home-film-cover-title">' + frame.title + '</span>';
      photo.appendChild(link);
    }

    return frameEl;
  }

  function decodeCoverImages() {
    const imgs = stripEl.querySelectorAll('.home-film-frame.is-cover img');
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

  function queueAllScrubImages(priorityPaths = []) {
    if (typeof HomeScrubImages === 'undefined') return;
    priorityPaths.forEach((path) => HomeScrubImages.queue(path, { priority: true }));
    frames.filter(f => !f.isCover).forEach((f) => {
      if (!priorityPaths.includes(f.src)) HomeScrubImages.queue(f.src);
    });
  }

  function warmRollImages(fromIndex, toIndex) {
    if (fromIndex >= toIndex) return;
    const paths = [];
    for (let i = fromIndex + 1; i <= toIndex; i++) {
      if (!frames[i]?.src || frames[i].isCover) continue;
      paths.push(frames[i].src);
    }
    if (typeof HomeScrubImages !== 'undefined' && paths.length) {
      HomeScrubImages.queueMany(paths, { priority: true });
    }
  }

  function warmAdjacentRolls() {
    const prevStart = coverIndices[currentRollIndex - 1];
    const nextEnd = coverIndices[currentRollIndex + 1];
    if (prevStart != null) warmRollImages(prevStart, currentIndex);
    if (nextEnd != null) warmRollImages(currentIndex, nextEnd);
  }

  function snapToCover(rollIndex) {
    currentRollIndex = rollIndex;
    currentIndex = coverIndices[rollIndex];
    setStripPosition(currentIndex);
    warmAdjacentRolls();
  }

  function finishAdvance(nextRoll, toIndex) {
    if (typeof HomeFilmSound !== 'undefined') HomeFilmSound.stopScrub();
    currentRollIndex = nextRoll;
    currentIndex = toIndex;
    resetStripMotionState();
    setStripPosition(currentIndex);
    animating = false;
    advanceBtn.disabled = false;
    warmAdjacentRolls();
    if (typeof HomeFilmSound !== 'undefined') HomeFilmSound.land();
  }

  function animateLoopToStart(fromIndex) {
    const scrubFrames = [];
    for (let i = fromIndex + 1; i < frames.length; i++) {
      if (frames[i].isCover) break;
      scrubFrames.push(i);
    }
    if (!scrubFrames.length) {
      for (let i = fromIndex - 1; i >= 0; i--) {
        if (frames[i].isCover) break;
        scrubFrames.push(i);
      }
    }

    const endIndex = scrubFrames.length ? scrubFrames[scrubFrames.length - 1] : fromIndex;
    warmRollImages(fromIndex, endIndex);

    const frameCount = Math.max(1, endIndex - fromIndex);
    const duration = scrubDurationForFrames(scrubFrames.length || 1);
    const start = performance.now();
    if (typeof HomeFilmSound !== 'undefined') HomeFilmSound.startScrub();

    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const pos = fromIndex + easeScrub(t) * frameCount;
      setStripPosition(pos, { scrubbing: t > 0.08 && t < 0.94 });
      if (typeof HomeFilmSound !== 'undefined') HomeFilmSound.tickScrub(pos);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        viewportEl.style.opacity = '0';
        setTimeout(() => {
          finishAdvance(0, coverIndices[0]);
          viewportEl.style.opacity = '';
        }, reduceMotion ? 0 : 120);
      }
    }

    requestAnimationFrame(tick);
  }

  function animateAdvance() {
    if (animating) return;
    if (typeof HomeFilmSound !== 'undefined') HomeFilmSound.advance();

    const nextRoll = (currentRollIndex + 1) % rollCount;
    const toIndex = coverIndices[currentRollIndex + 1];

    animating = true;
    advanceBtn.disabled = true;
    gateMark.classList.remove('is-link-ready');

    try {
      if (reduceMotion || toIndex == null) {
        finishAdvance(nextRoll, toIndex ?? coverIndices[0]);
        return;
      }

      if (currentRollIndex === rollCount - 1) {
        animateLoopToStart(currentIndex);
        return;
      }

      const fromIndex = currentIndex;
      const frameCount = Math.max(1, toIndex - fromIndex);
      warmRollImages(fromIndex, toIndex);
      const duration = scrubDurationForFrames(frameCount);
      const start = performance.now();
      if (typeof HomeFilmSound !== 'undefined') HomeFilmSound.startScrub();

      function tick(now) {
        const t = Math.min(1, (now - start) / duration);
        const pos = fromIndex + easeScrub(t) * frameCount;
        setStripPosition(pos, { scrubbing: t > 0.08 && t < 0.94 });
        if (typeof HomeFilmSound !== 'undefined') HomeFilmSound.tickScrub(pos);

        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          finishAdvance(nextRoll, toIndex);
        }
      }

      requestAnimationFrame(tick);
    } catch (err) {
      console.error(err);
      finishAdvance(nextRoll, toIndex ?? coverIndices[0]);
    }
  }

  async function boot() {
    try {
      const data = await loadHomeFilmstripData();
      frames = data.frames;
      coverIndices = data.coverIndices;
      rollCount = coverIndices.length;

      if (!frames.length) {
        loadingEl.textContent = 'no photos yet — add some in the organizer';
        return;
      }

      loadingEl.textContent = 'loading film…';
      advanceBtn.disabled = true;

      updateFrameWidth();
      stripEl.innerHTML = '';
      frames.forEach((frame, i) => {
        stripEl.appendChild(buildFrameEl(frame, i));
      });
      frameEls = [...stripEl.querySelectorAll('.home-film-frame')];
      resetStripMotionState();

      measureFrameStep();
      syncRollScaleSoon();
      snapToCover(0);

      loadingEl.hidden = true;
      advanceBtn.disabled = false;

      advanceBtn.addEventListener('click', animateAdvance);

      document.addEventListener('keydown', (e) => {
        if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
        if (e.key === ' ' || e.key === 'ArrowRight') {
          e.preventDefault();
          animateAdvance();
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

      const coverPaths = frames.filter(f => f.isCover).map(f => f.src);
      if (typeof HomeScrubImages !== 'undefined') {
        HomeScrubImages.preloadCovers(coverPaths).then(() => {
          decodeCoverImages().then(() => syncRollScaleSoon());
        });
      }
      queueAllScrubImages();
    } catch (err) {
      console.error(err);
      loadingEl.textContent = 'could not load filmstrip';
      advanceBtn.disabled = frames.length > 0 ? false : true;
    }
  }

  boot();
})();
