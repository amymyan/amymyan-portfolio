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
    'alexandra davis'
  ];

  const separator = '        ✮        ';
  const run = artists.join(separator) + separator;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobileQuery = window.matchMedia('(max-width: 560px)');

  textPath.textContent = run + run;

  let scrollRafId = null;

  function measureHalfLength() {
    return textPath.getComputedTextLength() / 2;
  }

  function getScrollSpeed(halfLen) {
    const svg = textPath.ownerSVGElement;
    const vb = svg?.viewBox?.baseVal;
    const vbWidth = vb?.width || 1200;
    const scale = svg ? svg.getBoundingClientRect().width / vbWidth : 1;
    const pxPerSec = mobileQuery.matches ? 115 : 95;
    if (scale > 0) return pxPerSec / scale;
    return (14 * halfLen) / run.length;
  }

  function startScroll() {
    const halfLen = measureHalfLength();
    if (!halfLen) {
      requestAnimationFrame(startScroll);
      return;
    }

    if (scrollRafId) cancelAnimationFrame(scrollRafId);

    let pxPerSec = getScrollSpeed(halfLen);
    let offset = 0;
    let last = performance.now();

    function tick(now) {
      pxPerSec = getScrollSpeed(halfLen);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      offset -= pxPerSec * dt;
      if (offset <= -halfLen) offset += halfLen;
      textPath.setAttribute('startOffset', offset);
      scrollRafId = requestAnimationFrame(tick);
    }

    scrollRafId = requestAnimationFrame(tick);
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

  window.addEventListener('resize', () => {
    requestAnimationFrame(startScroll);
  });
})();
