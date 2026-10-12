/* Landing hero.
   Wide screens: the wordmark is a fixed layer that slides away, then the
   page underneath follows. Scroll only writes transforms. Measuring happens
   on real width changes, not on every frame.
   Narrow screens (max-width 700px): the hero sits in normal document flow
   and the finger scrolls the page itself. A phone cannot compositor-scroll
   a fixed layer that JavaScript moves every frame. */

(function initHomeHero() {
  const hero = document.querySelector('.home-hero');
  if (!hero) return;

  const main = document.querySelector('main.home-film');
  const under = document.querySelector('.home-under');
  const spacer = document.querySelector('.home-reveal-spacer');
  if (!main || !under || !spacer) return;

  const nativeScroll = window.matchMedia('(max-width: 700px)');

  let underHeight = 0;
  let lastWidth = window.innerWidth;
  let frame = 0;
  let listening = false;

  function readView() {
    return window.innerHeight || document.documentElement.clientHeight || 0;
  }

  function releaseNative() {
    if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    if (hero.style.transform) hero.style.transform = '';
    if (under.style.transform) under.style.transform = '';
    if (spacer.style.height) spacer.style.height = '';
  }

  function measure() {
    if (nativeScroll.matches) {
      releaseNative();
      return;
    }
    const view = readView();
    underHeight = Math.max(under.scrollHeight, view);
    const next = (underHeight + view) + 'px';
    if (spacer.style.height !== next) spacer.style.height = next;
  }

  function paint() {
    if (nativeScroll.matches) return;
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    const view = readView();
    const shift = Math.min(Math.max(y, 0), view);
    hero.style.transform = 'translate3d(0,' + (-shift) + 'px,0)';
    under.style.transform = 'translate3d(0,' + (-Math.max(0, y - view)) + 'px,0)';
  }

  function onScroll() {
    if (nativeScroll.matches) return;
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      if (nativeScroll.matches) return;
      paint();
    });
  }

  function syncMode() {
    syncObserver();
    if (nativeScroll.matches) {
      if (listening) {
        window.removeEventListener('scroll', onScroll);
        listening = false;
      }
      releaseNative();
      return;
    }
    if (!listening) {
      window.addEventListener('scroll', onScroll, { passive: true });
      listening = true;
    }
    measure();
    paint();
  }

  let observer = null;
  let observing = false;
  if (window.ResizeObserver) {
    observer = new ResizeObserver(() => {
      if (nativeScroll.matches) return;
      measure();
      paint();
    });
  }

  function syncObserver() {
    if (!observer) return;
    if (nativeScroll.matches) {
      if (observing) {
        observer.disconnect();
        observing = false;
      }
      return;
    }
    if (!observing) {
      observer.observe(under);
      observing = true;
    }
  }

  window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const widthChanged = width !== lastWidth;
    if (widthChanged) lastWidth = width;
    if (nativeScroll.matches) {
      if (widthChanged) releaseNative();
      return;
    }
    paint();
    if (widthChanged) measure();
  });

  if (nativeScroll.addEventListener) nativeScroll.addEventListener('change', syncMode);
  else if (nativeScroll.addListener) nativeScroll.addListener(syncMode);

  syncMode();
})();
