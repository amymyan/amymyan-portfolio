/* Homepage filmstrip — advance cover to cover */

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

  function easeAdvance(t) {
    if (t >= 1) return 1;
    const smooth = t * t * (3 - 2 * t);
    return t * 0.62 + smooth * 0.38;
  }

  function advanceDuration(steps) {
    const n = Math.max(1, Math.abs(steps));
    return Math.min(1800, 720 + n * 320);
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
      gateMark.classList.toggle('is-link-ready', !animating);
      return;
    }

    gateMark.classList.remove('is-link-ready');
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
    resetStripMotionState();
    if (snap) trackEl.style.transition = 'none';
    setStripPosition(currentIndex);
    if (snap) {
      requestAnimationFrame(() => {
        trackEl.style.transition = '';
      });
    }
    animating = false;
    advanceBtn.disabled = false;
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

  function animateAdvance() {
    if (animating) return;
    if (typeof HomeFilmSound !== 'undefined') HomeFilmSound.advance();

    const nextRoll = (currentRollIndex + 1) % rollCount;
    const toIndex = coverIndices[nextRoll];
    const loopIndex = frameEls.length - 1;
    const loopingForward = currentRollIndex === rollCount - 1 && loopIndex > currentIndex;

    animating = true;
    advanceBtn.disabled = true;
    gateMark.classList.remove('is-link-ready');

    try {
      if (reduceMotion || toIndex == null) {
        finishAdvance(nextRoll, toIndex ?? coverIndices[0]);
        return;
      }

      const targetIndex = loopingForward ? loopIndex : toIndex;
      runAdvanceAnimation(currentIndex, targetIndex, () => {
        if (loopingForward) {
          finishAdvance(0, coverIndices[0], { snap: true });
        } else {
          finishAdvance(nextRoll, toIndex);
        }
      });
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

      const leadingClone = buildFrameEl(frames[frames.length - 1], 0);
      leadingClone.classList.add('home-film-frame--loop-clone');
      leadingClone.setAttribute('aria-hidden', 'true');
      stripEl.appendChild(leadingClone);

      frames.forEach((frame, i) => {
        stripEl.appendChild(buildFrameEl(frame, i + 1, { eager: i === 0 }));
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

      decodeCoverImages().then(() => syncRollScaleSoon());
    } catch (err) {
      console.error(err);
      loadingEl.textContent = 'could not load filmstrip';
      advanceBtn.disabled = frames.length > 0 ? false : true;
    }
  }

  boot();
})();
