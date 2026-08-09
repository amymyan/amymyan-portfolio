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

  textPath.textContent = run + run;

  function measureHalfLength() {
    return textPath.getComputedTextLength() / 2;
  }

  function startScroll() {
    const halfLen = measureHalfLength();
    if (!halfLen) {
      requestAnimationFrame(startScroll);
      return;
    }

    // Fixed reading speed — adding artists lengthens the loop, not the pace.
    const CHARS_PER_SECOND = 14;
    const pxPerChar = halfLen / run.length;
    const pxPerSec = CHARS_PER_SECOND * pxPerChar;
    let offset = 0;
    let last = performance.now();

    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      offset -= pxPerSec * dt;
      if (offset <= -halfLen) offset += halfLen;
      textPath.setAttribute('startOffset', offset);
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  if (reducedMotion) {
    textPath.setAttribute('startOffset', '0');
    return;
  }

  if (document.fonts?.ready) {
    document.fonts.ready.then(() => requestAnimationFrame(startScroll));
  } else {
    requestAnimationFrame(startScroll);
  }
})();
