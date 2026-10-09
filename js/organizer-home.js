/* Organizer — homepage filmstrip random cover pool */

let homeConfigData = null;

async function loadHomeConfigFromDisk() {
  const raw = await readJSON('data', 'home.json');
  if (Array.isArray(raw) || !raw) return normalizeHomeConfig({});
  return normalizeHomeConfig(raw);
}

async function saveHomeConfig(config) {
  const artists = Array.isArray(config.artists)
    ? normalizeArtistNames(config.artists)
    : [...HOME_ARTIST_DEFAULTS];
  config.artists = artists;
  await writeJSON('data', 'home.json', {
    rolls: config.rolls
      .filter(r => HOME_ROLL_DEFAULTS.some(def => def.id === r.id))
      .map(r => {
        const pool = uniqueSrcs((r.coverPoolSrcs || []).map(s => (s || '').trim()).filter(Boolean));
        return {
          id: r.id,
          href: r.href,
          title: r.title,
          coverSrc: r.coverSrc || pool[0] || '',
          coverPoolSrcs: pool
        };
      }),
    coverGridSrcs: uniqueSrcs((config.coverGridSrcs || []).map(s => (s || '').trim()).filter(Boolean)),
    artists
  });
  homeConfigData = config;
}

function getRollPool(entry, roll) {
  const saved = uniqueSrcs((entry.coverPoolSrcs || []).map(s => (s || '').trim()).filter(Boolean));
  if (saved.length) return saved.filter(src => roll.photos.includes(src));
  const legacy = uniqueSrcs([
    entry.coverSrc || roll.coverSrc,
    ...(entry.scrubSrcs || [])
  ].map(s => (s || '').trim()).filter(Boolean));
  return legacy.filter(src => roll.photos.includes(src));
}

function setRollPool(entry, pool) {
  entry.coverPoolSrcs = uniqueSrcs(pool);
  entry.scrubSrcs = [];
  entry.coverSrc = entry.coverPoolSrcs[0] || entry.coverSrc || '';
}

function renderHomeRollPanel(container, roll, config, rolls) {
  const entry = config.rolls.find(r => r.id === roll.id) || {};
  let pool = getRollPool(entry, roll);
  if (!pool.length && roll.photos.length) pool = [roll.photos[0]];
  setRollPool(entry, pool);

  const section = document.createElement('section');
  section.className = 'home-roll-panel';

  const head = document.createElement('div');
  head.className = 'home-roll-head';
  head.innerHTML =
    '<h3>' + roll.title + '</h3>' +
    '<p class="home-roll-meta">' + roll.id + ' · ' + roll.photos.length + ' available · click photos to include in random pool</p>';
  section.appendChild(head);

  const poolMeta = document.createElement('div');
  poolMeta.className = 'home-roll-scrub-meta';
  poolMeta.innerHTML =
    '<span class="home-roll-scrub-count">' + pool.length + ' selected for random cover</span>' +
    '<span style="display:flex;gap:0.35rem;flex-wrap:wrap;">' +
      '<button type="button" class="home-roll-scrub-clear home-roll-pool-all">select all</button>' +
      '<button type="button" class="home-roll-scrub-clear home-roll-pool-clear">clear all</button>' +
    '</span>';
  section.appendChild(poolMeta);

  const countEl = poolMeta.querySelector('.home-roll-scrub-count');
  const selectAllBtn = poolMeta.querySelector('.home-roll-pool-all');
  const clearAllBtn = poolMeta.querySelector('.home-roll-pool-clear');

  const grid = document.createElement('div');
  grid.className = 'home-roll-grid';

  function syncPoolUI() {
    const active = getRollPool(entry, roll);
    countEl.textContent = active.length + ' selected for random cover';
    clearAllBtn.disabled = !active.length;
    grid.querySelectorAll('.home-roll-pick').forEach(btn => {
      const src = btn.dataset.src;
      btn.classList.toggle('is-pool', active.includes(src));
    });
  }

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
      btn.className = 'home-roll-pick' + (pool.includes(src) ? ' is-pool' : '');
      btn.title = pool.includes(src) ? 'remove from random pool' : 'add to random pool';

      const img = document.createElement('img');
      img.alt = '';
      setOrganizerLazyImg(img, src, {
        onBroken: () => {
          btn.disabled = true;
          btn.style.opacity = '0.35';
          btn.title = 'missing on R2';
        }
      });
      btn.appendChild(img);

      btn.addEventListener('click', async () => {
        let next = getRollPool(entry, roll);
        if (next.includes(src)) {
          next = next.filter(s => s !== src);
        } else {
          next = uniqueSrcs([...next, src]);
        }
        if (!next.length) {
          setStatus('keep at least one photo in the pool');
          return;
        }
        setRollPool(entry, next);
        resolveCoverGridSrcs(config, rolls);
        syncPoolUI();
        await saveHomeConfig(config);
        refreshHomeCoverGridPanel(config, rolls);
        setStatus('random pool saved \u2713 — ' + roll.title);
      });

      grid.appendChild(btn);
    });
    section.appendChild(grid);
  }

  selectAllBtn.addEventListener('click', async () => {
    setRollPool(entry, roll.photos);
    resolveCoverGridSrcs(config, rolls);
    syncPoolUI();
    await saveHomeConfig(config);
    refreshHomeCoverGridPanel(config, rolls);
    setStatus('all photos selected \u2713 — ' + roll.title);
  });

  clearAllBtn.addEventListener('click', async () => {
    if (!roll.photos.length) return;
    setRollPool(entry, [roll.photos[0]]);
    resolveCoverGridSrcs(config, rolls);
    syncPoolUI();
    await saveHomeConfig(config);
    refreshHomeCoverGridPanel(config, rolls);
    setStatus('pool reset to one photo \u2713 — ' + roll.title);
  });

  syncPoolUI();
  container.appendChild(section);
}

function renderHomeCoverGridPanel(container, config, rolls) {
  if (!container) return;

  resolveCoverGridSrcs(config, rolls);
  const order = config.coverGridSrcs || [];
  const cols = 4;
  const shown = Math.floor(order.length / cols) * cols;

  container.innerHTML = '';

  const head = document.createElement('div');
  head.className = 'home-cover-grid-organizer-head';
  head.innerHTML =
    '<h3>cover photo grid</h3>' +
    '<p class="home-roll-meta">drag to set the order on the homepage grid below the filmstrip. ' +
    shown + ' of ' + order.length + ' photos show on the live site (4 per row).</p>';
  container.appendChild(head);

  if (!order.length) {
    const empty = document.createElement('p');
    empty.className = 'home-roll-empty';
    empty.textContent = 'select photos in the rolls above first';
    container.appendChild(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'home-cover-grid-organizer-grid';

  let dragSrc = null;

  order.forEach((src, index) => {
    const item = document.createElement('div');
    item.className = 'home-cover-grid-organizer-item';
    item.dataset.src = src;
    item.draggable = true;
    if (index >= shown) item.classList.add('is-trimmed');

    const img = document.createElement('img');
    img.alt = '';
    setOrganizerLazyImg(img, src);
    item.appendChild(img);

    item.addEventListener('dragstart', e => {
      dragSrc = src;
      item.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('is-dragging');
      dragSrc = null;
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    item.addEventListener('drop', async e => {
      e.preventDefault();
      if (!dragSrc || dragSrc === src) return;
      const list = [...config.coverGridSrcs];
      const from = list.indexOf(dragSrc);
      const to = list.indexOf(src);
      if (from < 0 || to < 0) return;
      list.splice(from, 1);
      list.splice(to, 0, dragSrc);
      config.coverGridSrcs = list;
      await saveHomeConfig(config);
      setStatus('grid order saved \u2713');
      renderHomeCoverGridPanel(container, config, rolls);
    });

    grid.appendChild(item);
  });

  container.appendChild(grid);
}

function renderHomeArtistsPanel(config) {
  const container = document.getElementById('home-artists-organizer');
  if (!container) return;

  if (!Array.isArray(config.artists)) {
    config.artists = [...HOME_ARTIST_DEFAULTS];
  }

  container.innerHTML = '';

  const section = document.createElement('section');
  section.className = 'home-artists-panel';

  const head = document.createElement('div');
  head.className = 'home-roll-head';
  head.innerHTML =
    '<h3>artists</h3>' +
    '<p class="home-roll-meta">names you’ve worked with. they scroll along the wavy line under the filmstrip.</p>';
  section.appendChild(head);

  const artists = config.artists;

  if (!artists.length) {
    const empty = document.createElement('p');
    empty.className = 'home-roll-empty';
    empty.textContent = 'no artists yet — add a name below';
    section.appendChild(empty);
  } else {
    const list = document.createElement('ul');
    list.className = 'home-artists-list';

    artists.forEach((name, index) => {
      const item = document.createElement('li');
      item.className = 'home-artists-item';

      const label = document.createElement('span');
      label.textContent = name;

      const controls = document.createElement('div');
      controls.className = 'controls';

      const up = document.createElement('button');
      up.type = 'button';
      up.textContent = '\u2191';
      up.title = 'move earlier';
      up.setAttribute('aria-label', 'move ' + name + ' earlier');
      up.disabled = index === 0;

      const down = document.createElement('button');
      down.type = 'button';
      down.textContent = '\u2193';
      down.title = 'move later';
      down.setAttribute('aria-label', 'move ' + name + ' later');
      down.disabled = index === artists.length - 1;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '\u00d7';
      remove.title = 'remove';
      remove.setAttribute('aria-label', 'remove ' + name);

      up.addEventListener('click', () => moveArtist(index, -1));
      down.addEventListener('click', () => moveArtist(index, 1));
      remove.addEventListener('click', () => removeArtist(index));

      controls.append(up, down, remove);
      item.append(label, controls);
      list.appendChild(item);
    });

    section.appendChild(list);
  }

  const form = document.createElement('form');
  form.className = 'home-artists-add';

  const input = document.createElement('input');
  input.type = 'text';
  input.name = 'artist';
  input.placeholder = 'artist name';
  input.setAttribute('aria-label', 'artist name');
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.maxLength = 80;

  const addBtn = document.createElement('button');
  addBtn.type = 'submit';
  addBtn.textContent = 'add artist';

  form.append(input, addBtn);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = input.value.replace(/\s+/g, ' ').trim();
    if (!name) {
      input.focus();
      return;
    }
    const exists = config.artists.some(entry => entry.toLowerCase() === name.toLowerCase());
    if (exists) {
      setStatus('that artist is already on the list');
      input.focus();
      input.select();
      return;
    }
    config.artists = [...config.artists, name];
    try {
      await saveHomeConfig(config);
      setStatus('artist added \u2713 — ' + name);
      renderHomeArtistsPanel(config);
      container.querySelector('.home-artists-add input')?.focus();
    } catch (err) {
      config.artists = config.artists.filter(entry => entry !== name);
      console.error(err);
      setStatus('couldn\u2019t save artists');
    }
  });

  section.appendChild(form);
  container.appendChild(section);

  async function moveArtist(index, delta) {
    const next = [...config.artists];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const previous = config.artists;
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    config.artists = next;
    try {
      await saveHomeConfig(config);
      setStatus('artist order saved \u2713');
      renderHomeArtistsPanel(config);
    } catch (err) {
      config.artists = previous;
      console.error(err);
      setStatus('couldn\u2019t save artists');
    }
  }

  async function removeArtist(index) {
    const previous = config.artists;
    const removed = previous[index];
    config.artists = previous.filter((_, i) => i !== index);
    try {
      await saveHomeConfig(config);
      setStatus('removed ' + removed + ' \u2713');
      renderHomeArtistsPanel(config);
    } catch (err) {
      config.artists = previous;
      console.error(err);
      setStatus('couldn\u2019t save artists');
    }
  }
}

function refreshHomeCoverGridPanel(config, rolls) {
  const gridContainer = document.getElementById('home-cover-grid-organizer');
  if (gridContainer) renderHomeCoverGridPanel(gridContainer, config, rolls);
}

async function purgeBrokenHomeRollSrc(rollId, src, { refresh = true } = {}) {
  const pageByRoll = { music: 'music', portrait: 'portrait', video: 'video' };
  const pageName = pageByRoll[rollId];
  if (pageName) await purgeBrokenBoardSrc(src, { pageName, announce: false });

  if (homeConfigData && typeof saveHomeConfig === 'function') {
    const roll = homeConfigData.rolls.find(r => r.id === rollId);
    if (roll) {
      roll.coverPoolSrcs = (roll.coverPoolSrcs || []).filter(s => s !== src);
      if (roll.coverSrc === src) roll.coverSrc = roll.coverPoolSrcs[0] || '';
      roll.scrubSrcs = [];
    }
    if (Array.isArray(homeConfigData.coverGridSrcs)) {
      homeConfigData.coverGridSrcs = homeConfigData.coverGridSrcs.filter(s => s !== src);
    }
    await saveHomeConfig(homeConfigData);
  }

  if (refresh && typeof initHomePanel === 'function') await initHomePanel();
  else setStatus('removed broken image from homepage roll \u2713');
}

async function pruneBrokenHomeRollSources() {
  if (!rootHandle || typeof filterLoadableSrcs !== 'function') return 0;

  const [music, portrait, video] = await Promise.all([
    readJSON('data', 'music.json'),
    readJSON('data', 'portrait.json'),
    readJSON('data', 'video.json')
  ]);

  const rolls = buildHomeRolls(homeConfigData || {}, { music, portrait, video });
  const allSrcs = rolls.flatMap(r => uniqueSrcs([...(r.coverPoolSrcs || []), r.coverSrc, ...r.photos]));
  if (!allSrcs.length) return 0;

  const loadable = await filterLoadableSrcs(allSrcs);
  const broken = allSrcs.filter(src => !loadable.has(src));
  if (!broken.length) return 0;

  for (const src of broken) {
    const roll = rolls.find(r => uniqueSrcs([...(r.coverPoolSrcs || []), r.coverSrc, ...r.photos]).includes(src));
    if (roll) await purgeBrokenHomeRollSrc(roll.id, src, { refresh: false });
  }

  homeConfigData = await loadHomeConfigFromDisk();
  setStatus('removed ' + broken.length + ' broken image(s) from homepage rolls \u2713');
  return broken.length;
}

let homePanelLoading = false;

async function initHomePanel({ pruneBroken = false } = {}) {
  const container = document.getElementById('home-roll-panels');
  const gridContainer = document.getElementById('home-cover-grid-organizer');
  const artistsContainer = document.getElementById('home-artists-organizer');
  if (!container) return;

  if (!rootHandle) {
    container.innerHTML = '<p class="home-roll-loading">connect your project folder above to load cover options…</p>';
    if (gridContainer) gridContainer.innerHTML = '';
    if (artistsContainer) {
      artistsContainer.innerHTML = '<p class="home-roll-loading">connect your project folder above to edit artists…</p>';
    }
    return;
  }

  if (homePanelLoading) return;
  homePanelLoading = true;
  container.innerHTML = '<p class="home-roll-loading">loading rolls…</p>';
  if (gridContainer) gridContainer.innerHTML = '';
  if (artistsContainer) {
    artistsContainer.innerHTML = '<p class="home-roll-loading">loading artists…</p>';
  }

  try {
    const [music, portrait, video] = await Promise.all([
      readJSON('data', 'music.json'),
      readJSON('data', 'portrait.json'),
      readJSON('data', 'video.json')
    ]);

    homeConfigData = await loadHomeConfigFromDisk();
    renderHomeArtistsPanel(homeConfigData);

    const rolls = buildHomeRolls(homeConfigData, { music, portrait, video });
    const gridBefore = JSON.stringify(homeConfigData.coverGridSrcs || []);
    resolveCoverGridSrcs(homeConfigData, rolls);
    if (JSON.stringify(homeConfigData.coverGridSrcs || []) !== gridBefore) {
      await saveHomeConfig(homeConfigData);
    }

    container.innerHTML = '';
    if (!rolls.length) {
      container.innerHTML = '<p class="home-roll-empty">no rolls found — check data/home.json</p>';
      if (gridContainer) gridContainer.innerHTML = '';
      return;
    }

    rolls.forEach(roll => {
      renderHomeRollPanel(container, roll, homeConfigData, rolls);
    });

    if (gridContainer) {
      renderHomeCoverGridPanel(gridContainer, homeConfigData, rolls);
    }

    if (pruneBroken) {
      pruneBrokenHomeRollSources().then((removed) => {
        if (removed) initHomePanel({ pruneBroken: false });
      }).catch(() => {});
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p class="home-roll-empty">error: ' + (err.message || err) + '</p>';
    if (gridContainer) gridContainer.innerHTML = '';
    if (artistsContainer && !artistsContainer.querySelector('.home-artists-panel')) {
      artistsContainer.innerHTML = '<p class="home-roll-empty">couldn\u2019t load artists</p>';
    }
  } finally {
    homePanelLoading = false;
  }
}
