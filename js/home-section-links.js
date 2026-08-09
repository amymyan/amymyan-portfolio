(function initHomeSectionLinks() {
  const nav = document.querySelector('.home-section-links');
  if (!nav) return;

  const links = [...nav.querySelectorAll('.home-section-link')];
  if (!links.length) return;

  const BASE = {
    refWidth: 1240,
    minScale: 0.38,
    fontSize: 23.2,
    minHeight: 60,
    padY: 10.4,
    padX: 32,
    gap: 80,
    border: 2,
    navPadX: 48,
    navPadY: 0
  };

  function applyScale() {
    const scale = Math.min(1, Math.max(BASE.minScale, window.innerWidth / BASE.refWidth));
    nav.style.gap = (BASE.gap * scale) + 'px';
    nav.style.padding =
      '0 ' + (BASE.navPadX * scale) + 'px';

    links.forEach(link => {
      link.style.fontSize = (BASE.fontSize * scale) + 'px';
      link.style.minHeight = (BASE.minHeight * scale) + 'px';
      link.style.padding = (BASE.padY * scale) + 'px ' + (BASE.padX * scale) + 'px';
      link.style.borderWidth = Math.max(1, BASE.border * scale) + 'px';
    });
  }

  applyScale();
  window.addEventListener('resize', applyScale);
})();
