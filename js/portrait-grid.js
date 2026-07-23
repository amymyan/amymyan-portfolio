/* Portrait page — 2-column masonry, natural aspect ratios */

function buildPortraitLightbox() {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.innerHTML = `
    <button class="lightbox-close" aria-label="close">&times;</button>
    <div class="lightbox-content"></div>
  `;
  document.body.appendChild(overlay);

  function close() {
    overlay.classList.remove('open');
    overlay.querySelector('.lightbox-content').innerHTML = '';
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('.lightbox-close').addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  return {
    open(item) {
      const content = overlay.querySelector('.lightbox-content');
      content.innerHTML = '';
      if (isVideoPath(item.src)) {
        const video = document.createElement('video');
        video.src = mediaSrc(item.src);
        video.controls = true;
        video.autoplay = true;
        video.playsInline = true;
        content.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.src = mediaSrc(item.src);
        img.alt = item.caption || '';
        content.appendChild(img);
      }
      overlay.classList.add('open');
    }
  };
}

(async function initPortraitGrid() {
  const grid = document.getElementById('portrait-grid');
  const emptyNote = document.getElementById('portrait-empty');
  if (!grid) return;

  const source = grid.dataset.source || 'data/portrait.json';
  const lightbox = buildPortraitLightbox();

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
      img.src = mediaSrcDisplay(item.src);
      img.alt = item.caption || '';
      img.loading = 'eager';
      img.decoding = 'async';
      const fullSrc = mediaSrc(item.src);
      if (img.src !== fullSrc) {
        img.addEventListener('error', () => {
          if (img.dataset.fullFallback) return;
          img.dataset.fullFallback = '1';
          img.src = fullSrc;
        }, { once: true });
      }
      figure.appendChild(img);
      bindImageRetain(img);
    }

    figure.addEventListener('click', () => lightbox.open(item));

    cols[portraitMasonryColumnIndex(index)].appendChild(figure);
  });

  preloadMediaPaths(items.map(item => item.src));
})();
