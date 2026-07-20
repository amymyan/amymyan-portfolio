/* Homepage filmstrip — roll config + photo loading */

const HOME_ROLL_DEFAULTS = [
  { id: 'music', href: 'music.html', title: 'live music ♪‧₊˚', coverSrc: 'assets/music/DSC03917.jpg' },
  { id: 'portrait', href: 'portrait.html', title: 'portraits ✶⋆.˚', coverSrc: 'assets/home/portrait.jpg' },
  { id: 'video', href: 'video.html', title: 'video ˚˖𓍢ִ໋❀', coverSrc: 'assets/home/video.jpg' }
];

const MAX_SCRUB_PHOTOS = 5;

function pickRandomCover(pool, exclude) {
  if (!pool?.length) return '';
  let choices = pool;
  if (exclude && pool.length > 1) {
    choices = pool.filter(src => src !== exclude);
    if (!choices.length) choices = pool;
  }
  return choices[Math.floor(Math.random() * choices.length)];
}

function resolveCoverPool(saved, photoPool, fallbackCover) {
  let pool = Array.isArray(saved.coverPoolSrcs)
    ? uniqueSrcs(saved.coverPoolSrcs.map(s => (s || '').trim()).filter(Boolean))
    : [];

  if (!pool.length) {
    pool = uniqueSrcs([
      saved.coverSrc,
      ...(Array.isArray(saved.scrubSrcs) ? saved.scrubSrcs : [])
    ].map(s => (s || '').trim()).filter(Boolean));
  }

  pool = pool.filter(src => photoPool.includes(src));

  if (!pool.length && fallbackCover && photoPool.includes(fallbackCover)) {
    pool = [fallbackCover];
  }
  if (!pool.length && photoPool.length) {
    pool = [photoPool[0]];
  }

  return pool;
}

function uniqueSrcs(list) {
  const seen = new Set();
  const out = [];
  for (const src of list) {
    const s = (src || '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function extractMusicPhotoSrcs(musicRaw) {
  if (!musicRaw) return [];
  if (Array.isArray(musicRaw)) {
    return uniqueSrcs(musicRaw.map(item => item.src));
  }
  if (musicRaw.sheets) {
    const srcs = [];
    for (const sheet of musicRaw.sheets) {
      for (const frame of sheet.frames || []) {
        if (frame?.src) srcs.push(frame.src);
      }
    }
    return uniqueSrcs(srcs);
  }
  return [];
}

function extractBoardImageSrcs(boardRaw) {
  if (!Array.isArray(boardRaw)) return [];
  return uniqueSrcs(
    boardRaw
      .filter(item => item.src?.trim() && !isVideoPath(item.src))
      .map(item => item.src)
  );
}

function extractVideoStripSrcs(videoRaw) {
  if (!Array.isArray(videoRaw)) return [];
  return uniqueSrcs(
    videoRaw.map(item => {
      if (item.poster?.trim()) return item.poster;
      if (item.src?.trim() && !isVideoPath(item.src)) return item.src;
      return '';
    })
  );
}

function subsamplePhotos(srcs, max = MAX_SCRUB_PHOTOS) {
  if (srcs.length <= max) return [...srcs];
  const copy = [...srcs];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, max);
}

function normalizeHomeConfig(raw) {
  const rollsIn = Array.isArray(raw?.rolls) ? raw.rolls : [];

  const rolls = HOME_ROLL_DEFAULTS.map((def, index) => {
    const saved = rollsIn.find(r => r.id === def.id) || rollsIn[index] || {};
    const coverSrc = (saved.coverSrc || def.coverSrc || '').trim();
    const coverPoolSrcs = Array.isArray(saved.coverPoolSrcs)
      ? uniqueSrcs(saved.coverPoolSrcs.map(s => (s || '').trim()).filter(Boolean))
      : uniqueSrcs([
          coverSrc,
          ...(Array.isArray(saved.scrubSrcs)
            ? saved.scrubSrcs.map(s => (s || '').trim()).filter(Boolean)
            : [])
        ].filter(Boolean));
    return {
      id: def.id,
      href: saved.href || def.href,
      title: saved.title || def.title,
      coverSrc,
      coverPoolSrcs,
      scrubSrcs: []
    };
  });

  return { rolls };
}

function ensureCoverInPhotos(photos, coverSrc, fallback) {
  const list = uniqueSrcs(photos);
  const cover = coverSrc || fallback || list[0] || '';
  if (cover && !list.includes(cover)) list.unshift(cover);
  if (!cover && list.length) return { coverSrc: list[0], photos: list };
  if (!list.length && cover) return { coverSrc: cover, photos: [cover] };
  return { coverSrc: cover || list[0] || '', photos: list.length ? list : (cover ? [cover] : []) };
}

function buildRollFromSources(rollConfig, photoSrcs, extraFallbacks = []) {
  const pool = uniqueSrcs([...photoSrcs, ...extraFallbacks, rollConfig.coverSrc]);
  const coverPoolSrcs = resolveCoverPool(rollConfig, pool, rollConfig.coverSrc);
  const coverSrc = rollConfig.coverSrc && pool.includes(rollConfig.coverSrc)
    ? rollConfig.coverSrc
    : (coverPoolSrcs[0] || pool[0] || '');

  return {
    ...rollConfig,
    coverSrc,
    coverPoolSrcs,
    photos: pool,
    scrub: [],
    scrubSrcs: []
  };
}

function buildHomeRolls(homeConfig, sources) {
  const config = normalizeHomeConfig(homeConfig);
  const musicSrcs = extractMusicPhotoSrcs(sources.music);
  const portraitSrcs = extractBoardImageSrcs(sources.portrait);
  const videoSrcs = extractVideoStripSrcs(sources.video);

  const byId = {
    music: buildRollFromSources(config.rolls.find(r => r.id === 'music') || config.rolls[0], musicSrcs),
    portrait: buildRollFromSources(config.rolls.find(r => r.id === 'portrait') || config.rolls[1], portraitSrcs),
    video: buildRollFromSources(config.rolls.find(r => r.id === 'video') || config.rolls[2], videoSrcs)
  };

  return HOME_ROLL_DEFAULTS.map(r => byId[r.id]).filter(Boolean);
}

function pruneRollMedia(roll, loadable) {
  if (!roll) return roll;
  const photos = roll.photos.filter(src => loadable.has(src));
  const coverPoolSrcs = (roll.coverPoolSrcs || [])
    .filter(src => loadable.has(src));
  let coverSrc = loadable.has(roll.coverSrc) ? roll.coverSrc : (coverPoolSrcs[0] || photos[0] || '');
  if (coverSrc && !photos.includes(coverSrc)) photos.unshift(coverSrc);
  const pool = coverPoolSrcs.length
    ? coverPoolSrcs
    : (coverSrc ? [coverSrc] : photos.slice(0, 1));
  return { ...roll, coverSrc, coverPoolSrcs: pool, photos, scrub: [], scrubSrcs: [] };
}

function buildStripFrames(rolls) {
  const frames = [];
  const coverIndices = [];

  for (const roll of rolls) {
    const pool = roll.coverPoolSrcs?.length
      ? roll.coverPoolSrcs
      : [roll.coverSrc].filter(Boolean);
    const coverSrc = pickRandomCover(pool) || roll.coverSrc || '';
    if (!coverSrc.trim()) continue;
    coverIndices.push(frames.length);
    frames.push({
      src: coverSrc,
      rollId: roll.id,
      coverPoolSrcs: pool,
      isCover: true,
      href: roll.href,
      title: roll.title
    });
  }

  return { frames, coverIndices };
}

async function fetchJSON(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function loadHomeFilmstripData() {
  const [homeConfig, music, portrait, video] = await Promise.all([
    fetchJSON('data/home.json'),
    fetchJSON('data/music.json'),
    fetchJSON('data/portrait.json'),
    fetchJSON('data/video.json')
  ]);

  const rolls = buildHomeRolls(homeConfig || {}, { music, portrait, video });
  return { rolls, ...buildStripFrames(rolls) };
}
