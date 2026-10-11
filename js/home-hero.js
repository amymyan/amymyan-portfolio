/* Landing hero: rhinestone wordmark scrolls away to reveal the page. */

(function initHomeHero() {
  const hero = document.querySelector('.home-hero');
  if (!hero) return;

  const main = document.querySelector('main.home-film');
  const under = document.querySelector('.home-under');
  const spacer = document.querySelector('.home-reveal-spacer');
  if (!main || !under || !spacer) return;

  function update() {
    const y = window.scrollY || document.documentElement.scrollTop || 0;
    const view = window.innerHeight;
    const shift = Math.min(Math.max(y, 0), view);
    hero.style.transform = 'translate3d(0, ' + (-shift) + 'px, 0)';
    under.style.transform = 'translate3d(0, ' + (-Math.max(0, y - view)) + 'px, 0)';
    const underHeight = Math.max(under.scrollHeight, view);
    const spacerHeight = underHeight + view;
    if (spacer.style.height !== spacerHeight + 'px') spacer.style.height = spacerHeight + 'px';
  }

  let frame = 0;
  window.addEventListener('scroll', () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      update();
    });
  }, { passive: true });

  if (window.ResizeObserver) {
    const observer = new ResizeObserver(update);
    observer.observe(under);
  }
  window.addEventListener('resize', update);
  update();
})();
