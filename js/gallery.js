/* Generic gallery loader. Each gallery page points this script at its own
   JSON file via data-source on the <script> tag, e.g.:
   <script src="js/gallery.js" data-source="data/music.json"></script> */

(async function () {
  const scriptTag = document.currentScript;
  const source = scriptTag.dataset.source;
  const grid = document.getElementById('gallery');
  const emptyNote = document.getElementById('empty-note');

  let items = [];
  try {
    const res = await fetch(source);
    items = await res.json();
  } catch (err) {
    console.error('Could not load', source, err);
  }

  items = items.filter(item => item.src);

  if (items.length === 0) {
    emptyNote.hidden = false;
    return;
  }

  items.forEach(item => {
    const figure = document.createElement('figure');
    const isVideo = /\.(mp4|webm|mov)$/i.test(item.src);

    if (isVideo) {
      const video = document.createElement('video');
      video.src = item.src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.controls = false;
      video.addEventListener('mouseenter', () => video.play());
      video.addEventListener('mouseleave', () => video.pause());
      figure.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = item.src;
      img.alt = item.caption || '';
      img.loading = 'lazy';
      figure.appendChild(img);
    }

    grid.appendChild(figure);
  });
})();
