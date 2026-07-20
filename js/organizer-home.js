/* Organizer — homepage filmstrip cover + scrub picker */

let homeConfigData = null;

async function loadHomeConfigFromDisk() {
  const raw = await readJSON('data', 'home.json');
  if (Array.isArray(raw) || !raw) return normalizeHomeConfig({});
  return normalizeHomeConfig(raw);
}

async function saveHomeConfig(config) {
  await writeJSON('data', 'home.json', {
    rolls: config.rolls
      .filter(r => HOME_ROLL_DEFAULTS.some(def => def.id === r.id))
      .map(r => ({
        id: r.id,
        href: r.href,
        title: r.title,
        coverSrc: r.coverSrc,
        scrubSrcs: uniqueSrcs(r.scrubSrcs || [])
          .filter(src => src && src !== r.coverSrc)
          .slice(0, MAX_SCRUB_PHOTOS)
      }))
  });
  homeConfigData = config;
}

function scrubCountForRoll(entry, coverSrc) {
  return (entry?.scrubSrcs || []).filter(src => src && src !== coverSrc).length;
}

function updateScrubCountLabel(section, entry, coverSrc) {
  const el = section.querySelector('.home-roll-scrub-count');
  if (el) {
    el.textContent = scrubCountForRoll(entry, coverSrc) + '/' + MAX_SCRUB_PHOTOS;
  }
  const clearBtn = section.querySelector('.home-roll-scrub-clear');
  if (clearBtn) {
    clearBtn.disabled = scrubCountForRoll(entry, coverSrc) === 0;
  }
}

function syncPickClasses(grid, entry, coverSrc) {
  const scrubSet = new Set((entry?.scrubSrcs || []).filter(src => src !== coverSrc));
  grid.querySelectorAll('.home-roll-pick').forEach(btn => {
    const src = btn.dataset.src;
    btn.classList.toggle('is-cover', src === coverSrc);
    btn.classList.toggle('is-scrub', scrubSet.has(src));
  });
}

function renderHomeRollPanel(container, roll, config) {
  const entry = config.rolls.find(r => r.id === roll.id) || {};
  const coverSrc = entry.coverSrc || roll.coverSrc;
  const scrubSet = new Set((entry.scrubSrcs || roll.scrubSrcs || []).filter(src => src !== coverSrc));

  const section = document.createElement('section');
  section.className = 'home-roll-panel';

  const head = document.createElement('div');
  head.className = 'home-roll-head';
  head.innerHTML =
    '<h3>' + roll.title + '</h3>' +
    '<p class="home-roll-meta">' + roll.id + ' · ' + roll.photos.length + ' available</p>';
  section.appendChild(head);

  const current = document.createElement('div');
  current.className = 'home-roll-current';
  current.innerHTML = '<span class="home-roll-label">cover</span>';
  const currentImg = document.createElement('img');
  currentImg.src = mediaSrc(coverSrc);
  currentImg.alt = roll.title + ' cover';
  currentImg.addEventListener('error', () => {
    currentImg.style.display = 'none';
    if (!current.querySelector('.home-roll-cover-missing')) {
      const note = document.createElement('span');
      note.className = 'home-roll-cover-missing';
      note.textContent = 'cover missing on R2 — pick another below';
      current.appendChild(note);
    }
  }, { once: true });
  current.appendChild(currentImg);
  section.appendChild(current);

  const scrubHint = document.createElement('div');
  scrubHint.className = 'home-roll-scrub-meta';
  const scrubLabel = document.createElement('span');
  scrubLabel.innerHTML =
    'scrub photos: <span class="home-roll-scrub-count">' +
    scrubCountForRoll(entry, coverSrc) + '/' + MAX_SCRUB_PHOTOS +
    '</span> — click = cover · shift+click = scrub';
  const clearScrubBtn = document.createElement('button');
  clearScrubBtn.type = 'button';
  clearScrubBtn.className = 'ghost home-roll-scrub-clear';
  clearScrubBtn.textContent = 'unselect all scrub';
  clearScrubBtn.disabled = scrubCountForRoll(entry, coverSrc) === 0;
  clearScrubBtn.addEventListener('click', async () => {
    if (!entry.scrubSrcs?.length) return;
    entry.scrubSrcs = [];
    await saveHomeConfig(config);
    syncPickClasses(grid, entry, entry.coverSrc);
    updateScrubCountLabel(section, entry, entry.coverSrc);
    clearScrubBtn.disabled = true;
    setStatus('scrub photos cleared \u2713 — ' + roll.title);
  });
  scrubHint.appendChild(scrubLabel);
  scrubHint.appendChild(clearScrubBtn);
  section.appendChild(scrubHint);

  const grid = document.createElement('div');
  grid.className = 'home-roll-grid';

  if (!roll.photos.length) {
    const empty = document.createElement('p');
    empty.className = 'home-roll-empty';
    empty.textContent = 'no photos yet — add some on the ' + roll.id + ' page first';
    section.appendChild(empty);
  } else {
    roll.photos.forEach(src => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.src = src;
      btn.className = 'home-roll-pick' +
        (src === coverSrc ? ' is-cover' : '') +
        (scrubSet.has(src) ? ' is-scrub' : '');
      btn.title = src === coverSrc ? 'cover frame' : 'click = cover · shift+click = scrub';

      const img = document.createElement('img');
      img.src = mediaSrc(src);
      img.alt = '';
      img.loading = 'lazy';
      btn.appendChild(img);

      btn.addEventListener('click', async (e) => {
        if (!entry.scrubSrcs) entry.scrubSrcs = [];

        if (e.shiftKey) {
          if (src === entry.coverSrc) {
            setStatus('cover can\u2019t also be a scrub photo — pick a different one');
            return;
          }
          const idx = entry.scrubSrcs.indexOf(src);
          if (idx >= 0) {
            entry.scrubSrcs.splice(idx, 1);
          } else if (scrubCountForRoll(entry, entry.coverSrc) >= MAX_SCRUB_PHOTOS) {
            setStatus('max ' + MAX_SCRUB_PHOTOS + ' scrub photos — shift+click one to remove first');
            return;
          } else {
            entry.scrubSrcs.push(src);
          }
          await saveHomeConfig(config);
          syncPickClasses(grid, entry, entry.coverSrc);
          updateScrubCountLabel(section, entry, entry.coverSrc);
          setStatus('scrub photos saved \u2713 — ' + scrubCountForRoll(entry, entry.coverSrc) + '/' + MAX_SCRUB_PHOTOS);
          return;
        }

        grid.querySelectorAll('.home-roll-pick').forEach(el => el.classList.remove('is-cover'));
        btn.classList.add('is-cover');
        entry.coverSrc = src;
        entry.scrubSrcs = entry.scrubSrcs.filter(s => s !== src);
        btn.classList.remove('is-scrub');

        currentImg.src = mediaSrc(src);
        currentImg.style.display = '';
        current.querySelector('.home-roll-cover-missing')?.remove();

        await saveHomeConfig(config);
        syncPickClasses(grid, entry, entry.coverSrc);
        updateScrubCountLabel(section, entry, entry.coverSrc);
        setStatus('cover saved \u2713 — ' + roll.title);
      });

      img.addEventListener('error', () => {
        btn.disabled = true;
        btn.style.opacity = '0.35';
        btn.title = 'missing on R2';
      }, { once: true });

      grid.appendChild(btn);
    });
    section.appendChild(grid);
  }

  container.appendChild(section);
}

async function purgeBrokenHomeRollSrc(rollId, src, { refresh = true } = {}) {
  const pageByRoll = { music: 'music', portrait: 'portrait', video: 'video' };
  const pageName = pageByRoll[rollId];
  if (pageName) await purgeBrokenBoardSrc(src, { pageName, announce: false });

  if (homeConfigData && typeof saveHomeConfig === 'function') {
    const roll = homeConfigData.rolls.find(r => r.id === rollId);
    if (roll) {
      if (roll.coverSrc === src) roll.coverSrc = '';
      if (Array.isArray(roll.scrubSrcs)) {
        roll.scrubSrcs = roll.scrubSrcs.filter(s => s !== src);
      }
    }
    await saveHomeConfig(homeConfigData);
  }

  if (refresh && typeof initHomePanel === 'function') await initHomePanel();
  else setStatus('removed broken image from homepage roll \u2713');
}

async function pruneBrokenHomeRollSources() {
  if (!rootHandle || typeof filterLoadableSrcs !== 'function') return;

  const [music, portrait, video] = await Promise.all([
    readJSON('data', 'music.json'),
    readJSON('data', 'portrait.json'),
    readJSON('data', 'video.json')
  ]);

  const rolls = buildHomeRolls(homeConfigData || {}, { music, portrait, video });
  const allSrcs = rolls.flatMap(r => uniqueSrcs([r.coverSrc, ...(r.scrubSrcs || []), ...r.photos]));
  if (!allSrcs.length) return;

  const loadable = await filterLoadableSrcs(allSrcs);
  const broken = allSrcs.filter(src => !loadable.has(src));
  if (!broken.length) return;

  for (const src of broken) {
    const roll = rolls.find(r => uniqueSrcs([r.coverSrc, ...(r.scrubSrcs || []), ...r.photos]).includes(src));
    if (roll) await purgeBrokenHomeRollSrc(roll.id, src, { refresh: false });
  }

  homeConfigData = await loadHomeConfigFromDisk();
  setStatus('removed ' + broken.length + ' broken image(s) from homepage rolls \u2713');
}

let homePanelLoading = false;

async function initHomePanel({ pruneBroken = false } = {}) {
  const container = document.getElementById('home-roll-panels');
  if (!container) return;

  if (!rootHandle) {
    container.innerHTML = '<p class="home-roll-loading">connect your project folder above to load cover options…</p>';
    return;
  }

  if (homePanelLoading) return;
  homePanelLoading = true;
  container.innerHTML = '<p class="home-roll-loading">loading rolls…</p>';

  try {
    const [music, portrait, video] = await Promise.all([
      readJSON('data', 'music.json'),
      readJSON('data', 'portrait.json'),
      readJSON('data', 'video.json')
    ]);

    homeConfigData = await loadHomeConfigFromDisk();
    if (pruneBroken) await pruneBrokenHomeRollSources();

    const rolls = buildHomeRolls(homeConfigData, { music, portrait, video });

    container.innerHTML = '';
    if (!rolls.length) {
      container.innerHTML = '<p class="home-roll-empty">no rolls found — check data/home.json</p>';
      return;
    }

    rolls.forEach(roll => {
      renderHomeRollPanel(container, roll, homeConfigData);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p class="home-roll-empty">error: ' + (err.message || err) + '</p>';
  } finally {
    homePanelLoading = false;
  }
}
