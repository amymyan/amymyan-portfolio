/* ============================================================
   GALLERY GRID PAGES (portrait / projects / tour)
   ============================================================
   One shared script for all three grid-style pages. Each page's
   <script> tag tells it which JSON file to load from, e.g.:
   <script src="js/gallery.js" data-source="data/portrait.json"></script>

   To add a new grid page, copy portrait.html, change its
   data-source to point at a new (empty) JSON file, and add the
   matching option in organizer.html's "gallery pages" dropdown.
   ============================================================ */

(async function () {
  const scriptTag = document.currentScript;
  const source = scriptTag.dataset.source;   // e.g. "data/portrait.json"
  const grid = document.getElementById('gallery');
  const emptyNote = document.getElementById('empty-note');

  let items = [];
  try {
    const res = await fetch(source);
    items = await res.json();
  } catch (err) {
    console.error('Could not load', source, err);
  }

  // Skip any entries that don't have a photo yet
  items = items.filter(item => item.src);

  if (items.length === 0) {
    emptyNote.hidden = false;   // shows "no photos yet..." message
    return;
  }

  items.forEach(item => {
    const figure = document.createElement('figure');
    const isVideo = /\.(mp4|webm|mov)$/i.test(item.src);

    if (isVideo) {
      // Videos autoplay (muted) only while the mouse hovers over them
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
      img.loading = 'lazy';   // browser delays loading offscreen images
      figure.appendChild(img);
    }

    grid.appendChild(figure);
  });
})();
