/* Video page — 2-column thumbnail grid + lightbox player */

const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';

function videoPlayButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'video-btn video-btn--play';
  btn.setAttribute('aria-label', 'play');
  btn.innerHTML = ICON_PLAY;
  return btn;
}

function buildVideoLightbox() {
  const overlay = document.createElement('div');
  overlay.className = 'video-lightbox';
  overlay.innerHTML = `
    <button class="video-lightbox-close" type="button" aria-label="close">&times;</button>
    <div class="video-lightbox-dialog" role="dialog" aria-modal="true" aria-label="video player">
      <div class="video-lightbox-content"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const content = overlay.querySelector('.video-lightbox-content');
  const closeBtn = overlay.querySelector('.video-lightbox-close');

  function close() {
    if (!overlay.classList.contains('open')) return;
    overlay.classList.remove('open');
    document.body.classList.remove('video-lightbox-open');
    content.querySelectorAll('video').forEach(video => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    });
    content.innerHTML = '';
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  return {
    open(item) {
      content.innerHTML = '';

      const video = document.createElement('video');
      video.src = mediaSrc(item.src);
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      if (item.poster) video.poster = mediaSrc(item.poster);
      video.addEventListener('loadedmetadata', () => {
        if (video.videoWidth && video.videoHeight) {
          video.style.aspectRatio = video.videoWidth + ' / ' + video.videoHeight;
        }
      });
      content.appendChild(video);

      if (item.caption) {
        const cap = document.createElement('p');
        cap.className = 'video-lightbox-caption';
        cap.textContent = item.caption;
        content.appendChild(cap);
      }

      overlay.classList.add('open');
      document.body.classList.add('video-lightbox-open');
      closeBtn.focus();
      video.play().catch(() => {});
    },
    close
  };
}

function attachThumbnail(video, onPlay) {
  const wrap = document.createElement('div');
  wrap.className = 'video-player';
  const playBtn = videoPlayButton();
  wrap.appendChild(video);
  wrap.appendChild(playBtn);

  playBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onPlay();
  });
  wrap.addEventListener('click', (e) => {
    e.preventDefault();
    onPlay();
  });

  return wrap;
}

function showVideoError(grid, messageHtml) {
  grid.innerHTML = '<p class="empty-note">' + messageHtml + '</p>';
}

(async function initVideoGrid() {
  const grid = document.getElementById('video-grid');
  const emptyNote = document.getElementById('video-empty');
  if (!grid) return;

  if (window.location.protocol === 'file:') {
    showVideoError(
      grid,
      'videos can\u2019t load when you double-click an html file. start a local server, then open the site in your browser.'
    );
    return;
  }

  const source = grid.dataset.source || 'data/video.json';
  let items = [];
  try {
    const res = await fetch(source);
    if (!res.ok) throw new Error(source + ' returned ' + res.status);
    items = await res.json();
  } catch (err) {
    console.error('Could not load', source, err);
    showVideoError(grid, 'couldn\u2019t load videos from <code>' + source + '</code>.');
    return;
  }

  if (!Array.isArray(items)) items = [];
  items = items.filter(item => item?.src?.trim());

  if (!items.length) {
    if (emptyNote) emptyNote.hidden = false;
    return;
  }

  const lightbox = buildVideoLightbox();

  items.forEach(item => {
    const figure = document.createElement('figure');
    figure.dataset.id = item.id || '';

    const video = document.createElement('video');
    video.src = mediaSrc(item.src);
    video.playsInline = true;
    video.preload = 'metadata';
    video.muted = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    if (item.poster) video.poster = mediaSrc(item.poster);
    const focusX = Number.isFinite(Number(item.posterFocusX)) ? Number(item.posterFocusX) : 50;
    const focusY = Number.isFinite(Number(item.posterFocusY)) ? Number(item.posterFocusY) : 50;
    video.style.objectPosition = focusX + '% ' + focusY + '%';
    video.addEventListener('error', () => figure.remove());

    figure.appendChild(attachThumbnail(video, () => lightbox.open(item)));

    if (item.caption) {
      const cap = document.createElement('figcaption');
      cap.className = 'video-caption';
      cap.textContent = item.caption;
      figure.appendChild(cap);
    }

    grid.appendChild(figure);
  });
})();
