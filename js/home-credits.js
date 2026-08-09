(function initHomeCredits() {
  const textPath = document.getElementById('home-credits-textpath');
  if (!textPath) return;

  const artists = [
    'josh conway',
    'djo',
    'kristiane',
    'claire rosinkranz',
    'landon contrath',
    'abby holliday',
    'artemas',
    'ella boh',
    'henry morris',
    'riff wood',
    'the cherry bombs',
    'mr. fantasy',
    'gianna yaccino',
    'naomi sato',
    'maddie park',
    'alexandra davis',
    'anna elyse'
  ];

  const separator = '        ✮        ';
  const run = artists.join(separator) + separator;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobileQuery = window.matchMedia('(max-width: 560px)');

  textPath.textContent = run + run;

  let scrollRafId = null;
  let offset = 0;
  let halfLen = 0;
  let last = 0;
  let resizeTimer = null;

  function estimateHalfLength() {
    const textEl = textPath.parentElement;
    const fontSize = parseFloat(getComputedStyle(textEl).fontSize) || 36;
    const letterSpacing = parseFloat(getComputedStyle(textEl).letterSpacing) || 0;
    const charW = fontSize * 0.52 + letterSpacing;
    return (run.length * charW) / 2;
  }

  function measureHalfLength() {
    const measured = textPath.getComputedTextLength();
    if (measured > 0) return measured / 2;
    return estimateHalfLength();
  }

  function getScrollSpeed() {
    const svg = textPath.ownerSVGElement;
    const vb = svg?.viewBox?.baseVal;
    const vbWidth = vb?.width || 1200;
    const scale = svg ? svg.getBoundingClientRect().width / vbWidth : 1;
    const pxPerSec = mobileQuery.matches ? 115 : 95;
    if (scale > 0) return pxPerSec / scale;
    return (14 * halfLen) / run.length;
  }

  function applyOffset() {
    if (!halfLen) return;
    while (offset <= -halfLen) offset += halfLen;
    while (offset > 0) offset -= halfLen;
    textPath.setAttribute('startOffset', offset);
  }

  function remeasure({ preserveOffset = true } = {}) {
    const prevHalf = halfLen;
    halfLen = measureHalfLength();
    if (!halfLen) return false;
    if (preserveOffset && prevHalf > 0) {
      const progress = Math.abs(offset) / prevHalf;
      offset = -progress * halfLen;
    }
    applyOffset();
    return true;
  }

  function tick(now) {
    if (!halfLen && !remeasure()) {
      scrollRafId = requestAnimationFrame(tick);
      return;
    }

    const pxPerSec = getScrollSpeed();
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    offset -= pxPerSec * dt;
    if (offset <= -halfLen) offset += halfLen;
    textPath.setAttribute('startOffset', offset);
    scrollRafId = requestAnimationFrame(tick);
  }

  function startScroll() {
    if (scrollRafId) return;
    if (!remeasure({ preserveOffset: false })) {
      requestAnimationFrame(startScroll);
      return;
    }
    last = 0;
    scrollRafId = requestAnimationFrame(tick);
  }

  function onViewportChange() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      remeasure({ preserveOffset: true });
    }, 200);
  }

  if (reducedMotion) {
    textPath.setAttribute('startOffset', '0');
    return;
  }

  function boot() {
    requestAnimationFrame(startScroll);
  }

  if (document.fonts?.ready) {
    document.fonts.ready.then(boot);
  } else {
    boot();
  }

  window.addEventListener('resize', onViewportChange, { passive: true });
  window.visualViewport?.addEventListener('resize', onViewportChange, { passive: true });
  window.visualViewport?.addEventListener('scroll', onViewportChange, { passive: true });
})();
