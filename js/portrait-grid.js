/* Portrait page — 2-column masonry, natural aspect ratios */

(async function initPortraitGrid() {
  const grid = document.getElementById('portrait-grid');
  const emptyNote = document.getElementById('portrait-empty');
  if (!grid) return;

  const source = grid.dataset.source || 'data/portrait.json';

  let items = [];
  try {
    const res = await fetch(source);
    if (res.ok) items = await res.json();
  } catch (err) {
    console.error('Could not load', source, err);
  }

  if (!Array.isArray(items)) items = [];
  items = items.filter(item => item?.src?.trim());

  if (!items.length) {
    if (emptyNote) emptyNote.hidden = false;
    return;
  }

  const cols = createPortraitMasonryColumns(grid);

  items.forEach((item, index) => {
    const figure = document.createElement('figure');
    figure.dataset.id = item.id || '';
    const isVideo = /\.(mp4|webm|mov)$/i.test(item.src);

    if (isVideo) {
      const video = document.createElement('video');
      video.src = mediaSrc(item.src);
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.controls = false;
      video.addEventListener('mouseenter', () => video.play().catch(() => {}));
      video.addEventListener('mouseleave', () => video.pause());
      figure.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = mediaSrc(item.src);
      img.alt = item.caption || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      figure.appendChild(img);
    }

    cols[portraitMasonryColumnIndex(index)].appendChild(figure);
  });
})();
