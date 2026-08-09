(async function initHomeCoverGrid() {
  const grid = document.getElementById('home-cover-grid');
  if (!grid || typeof loadHomeFilmstripData !== 'function' || typeof mediaSrc !== 'function') return;

  let allSrcs = [];

  function getCols() {
    const w = window.innerWidth;
    if (w <= 560) return 2;
    if (w <= 900) return 3;
    return 4;
  }

  function renderGrid() {
    const cols = getCols();
    const trimmed = allSrcs.slice(0, Math.floor(allSrcs.length / cols) * cols);

    grid.style.setProperty('--grid-cols', String(cols));
    grid.innerHTML = '';

    if (!trimmed.length) {
      grid.hidden = true;
      return;
    }

    grid.hidden = false;
    trimmed.forEach(src => {
      const cell = document.createElement('div');
      cell.className = 'home-cover-grid-cell';

      const img = document.createElement('img');
      img.src = mediaSrc(src);
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';

      cell.appendChild(img);
      grid.appendChild(cell);
    });
  }

  try {
    const data = await loadHomeFilmstripData();
    allSrcs = data.coverGridSrcs || [];
    renderGrid();
    window.addEventListener('resize', renderGrid);
  } catch (err) {
    console.error('Home cover grid failed:', err);
    grid.hidden = true;
  }
})();
