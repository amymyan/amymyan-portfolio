/* Organizer — homepage filmstrip random cover pool */

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
    coverGridSrcs: uniqueSrcs((config.coverGridSrcs || []).map(s => (s || '').trim()).filter(Boolean))
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
      img.src = mediaSrc(src);
      img.alt = '';
      img.loading = 'lazy';
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

      img.addEventListener('error', () => {
        btn.disabled = true;
        btn.style.opacity = '0.35';
        btn.title = 'missing on R2';
      }, { once: true });

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
    img.src = mediaSrc(src);
    img.alt = '';
    img.loading = 'lazy';
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
  if (!rootHandle || typeof filterLoadableSrcs !== 'function') return;

  const [music, portrait, video] = await Promise.all([
    readJSON('data', 'music.json'),
    readJSON('data', 'portrait.json'),
    readJSON('data', 'video.json')
  ]);

  const rolls = buildHomeRolls(homeConfigData || {}, { music, portrait, video });
  const allSrcs = rolls.flatMap(r => uniqueSrcs([...(r.coverPoolSrcs || []), r.coverSrc, ...r.photos]));
  if (!allSrcs.length) return;

  const loadable = await filterLoadableSrcs(allSrcs);
  const broken = allSrcs.filter(src => !loadable.has(src));
  if (!broken.length) return;

  for (const src of broken) {
    const roll = rolls.find(r => uniqueSrcs([...(r.coverPoolSrcs || []), r.coverSrc, ...r.photos]).includes(src));
    if (roll) await purgeBrokenHomeRollSrc(roll.id, src, { refresh: false });
  }

  homeConfigData = await loadHomeConfigFromDisk();
  setStatus('removed ' + broken.length + ' broken image(s) from homepage rolls \u2713');
}

let homePanelLoading = false;

async function initHomePanel({ pruneBroken = false } = {}) {
  const container = document.getElementById('home-roll-panels');
  const gridContainer = document.getElementById('home-cover-grid-organizer');
  if (!container) return;

  if (!rootHandle) {
    container.innerHTML = '<p class="home-roll-loading">connect your project folder above to load cover options…</p>';
    if (gridContainer) gridContainer.innerHTML = '';
    return;
  }

  if (homePanelLoading) return;
  homePanelLoading = true;
  container.innerHTML = '<p class="home-roll-loading">loading rolls…</p>';
  if (gridContainer) gridContainer.innerHTML = '';

  try {
    const [music, portrait, video] = await Promise.all([
      readJSON('data', 'music.json'),
      readJSON('data', 'portrait.json'),
      readJSON('data', 'video.json')
    ]);

    homeConfigData = await loadHomeConfigFromDisk();
    if (pruneBroken) await pruneBrokenHomeRollSources();

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
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p class="home-roll-empty">error: ' + (err.message || err) + '</p>';
    if (gridContainer) gridContainer.innerHTML = '';
  } finally {
    homePanelLoading = false;
  }
}
