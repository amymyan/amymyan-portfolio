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
  let lastViewportW = window.innerWidth;
  let lastViewportH = window.innerHeight;
  let measureCtx = null;

  function getCanvasMeasureCtx(textEl) {
    if (!measureCtx) {
      measureCtx = document.createElement('canvas').getContext('2d');
    }
    const style = getComputedStyle(textEl);
    measureCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return measureCtx;
  }

  function measureStraightCssWidth(text, textEl) {
    const ctx = getCanvasMeasureCtx(textEl);
    const style = getComputedStyle(textEl);
    const spacing = parseFloat(style.letterSpacing) || 0;
    let width = ctx.measureText(text).width;
    if (spacing && text.length > 1) width += spacing * (text.length - 1);
    return width;
  }

  function getSvgUserScale() {
    const svg = textPath.ownerSVGElement;
    const vb = svg?.viewBox?.baseVal;
    const vbWidth = vb?.width || 1200;
    const rectW = svg?.getBoundingClientRect().width || vbWidth;
    return rectW > 0 ? rectW / vbWidth : 1;
  }

  function estimateHalfLength() {
    const textEl = textPath.parentElement;
    const scale = getSvgUserScale();
    const straightSvg = measureStraightCssWidth(run, textEl) / scale;
    return straightSvg * 1.12;
  }

  function measureHalfLength() {
    const textEl = textPath.parentElement;
    const scale = getSvgUserScale();
    const straightSvg = measureStraightCssWidth(run, textEl) / scale;
    const pathEstimate = straightSvg * 1.12;
    const pathMeasured = textPath.getComputedTextLength() / 2;

    if (pathMeasured > pathEstimate * 0.9) return pathMeasured;
    if (mobileQuery.matches) return pathEstimate;
    return pathMeasured > 0 ? pathMeasured : pathEstimate;
  }

  function getScrollSpeed() {
    const scale = getSvgUserScale();
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
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w === lastViewportW && h === lastViewportH) return;
    lastViewportW = w;
    lastViewportH = h;

    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      remeasure({ preserveOffset: true });
    }, 250);
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
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportChange, { passive: true });
  }
})();
