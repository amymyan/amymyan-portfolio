/* Landing hero: rhinestone wordmark scrolls away to reveal the page.
   Scroll only moves layers. Measuring the page happens on real size changes,
   not on every frame — reading layout while scrolling freezes phones. */

(function initHomeHero() {
  const hero = document.querySelector('.home-hero');
  if (!hero) return;

  const main = document.querySelector('main.home-film');
  const under = document.querySelector('.home-under');
  const spacer = document.querySelector('.home-reveal-spacer');
  if (!main || !under || !spacer) return;

  let underHeight = 0;
  let lastWidth = window.innerWidth;

  function readView() {
    return window.innerHeight || document.documentElement.clientHeight || 0;
  }

  function measure() {
    const view = readView();
    underHeight = Math.max(under.scrollHeight, view);
    const next = (underHeight + view) + 'px';
    if (spacer.style.height !== next) spacer.style.height = next;
  }

  function paint() {
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    const view = readView();
    const shift = Math.min(Math.max(y, 0), view);
    hero.style.transform = 'translate3d(0,' + (-shift) + 'px,0)';
    under.style.transform = 'translate3d(0,' + (-Math.max(0, y - view)) + 'px,0)';
  }

  let frame = 0;
  window.addEventListener('scroll', () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      paint();
    });
  }, { passive: true });

  if (window.ResizeObserver) {
    const observer = new ResizeObserver(() => {
      measure();
      paint();
    });
    observer.observe(under);
  }

  window.addEventListener('resize', () => {
    paint();
    const width = window.innerWidth;
    if (width === lastWidth) return;
    lastWidth = width;
    measure();
  });

  measure();
  paint();
})();
