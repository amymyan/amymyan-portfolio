(async function initHomeCoverGrid() {
  const grid = document.getElementById('home-cover-grid');
  if (!grid || typeof loadHomeFilmstripData !== 'function' || typeof mediaSrc !== 'function') return;

  try {
    const data = await loadHomeFilmstripData();
    const cols = 4;
    const ordered = data.coverGridSrcs || [];
    const trimmed = ordered.slice(0, Math.floor(ordered.length / cols) * cols);
    if (!trimmed.length) {
      grid.hidden = true;
      return;
    }

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
  } catch (err) {
    console.error('Home cover grid failed:', err);
    grid.hidden = true;
  }
})();
