(function initCursorTrail() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'cursor-trail-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const root = document.documentElement;
  const PINK = getComputedStyle(root).getPropertyValue('--flash').trim() || '#FF1493';
  const style = getComputedStyle(root);
  const offsetX = parseFloat(style.getPropertyValue('--cursor-trail-offset-x')) || 0;
  const offsetY = parseFloat(style.getPropertyValue('--cursor-trail-offset-y')) || 0;

  const stars = [];
  const MAX_STARS = 72;
  const MIN_STEP = 10;
  const BASE_LIFE = 850;

  let width = 0;
  let height = 0;
  let lastX = null;
  let lastY = null;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pickKind() {
    const roll = Math.random();
    if (roll < 0.28) return 'dot';
    if (roll < 0.58) return 'star5';
    if (roll < 0.82) return 'star6';
    return 'diamond4';
  }

  function pickSize(kind) {
    if (kind === 'dot') return rand(0.7, 2.2);
    if (kind === 'star5') return rand(2, 5);
    if (kind === 'star6') return rand(2.2, 5.5);
    return rand(2.4, 6);
  }

  function pickColor() {
    return Math.random() < 0.35 ? '#ffffff' : PINK;
  }

  function polygonStar(points, outer, inner, rotation) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = rotation + (Math.PI / points) * i - Math.PI / 2;
      const r = i % 2 === 0 ? outer : inner;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawDot(x, y, size, angle, alpha, color) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStar5(x, y, size, angle, alpha, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    polygonStar(5, size, size * 0.42, 0);
    ctx.fill();
    ctx.restore();
  }

  function drawStar6(x, y, size, angle, alpha, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    polygonStar(6, size, size * 0.48, 0);
    ctx.fill();
    ctx.restore();
  }

  function drawDiamond4(x, y, size, angle, alpha, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    polygonStar(4, size, size * 0.28, Math.PI / 4);
    ctx.fill();
    ctx.restore();
  }

  function drawStar(star, alpha) {
    if (star.kind === 'dot') drawDot(star.x, star.y, star.size, star.angle, alpha, star.color);
    else if (star.kind === 'star5') drawStar5(star.x, star.y, star.size, star.angle, alpha, star.color);
    else if (star.kind === 'star6') drawStar6(star.x, star.y, star.size, star.angle, alpha, star.color);
    else drawDiamond4(star.x, star.y, star.size, star.angle, alpha, star.color);
  }

  function spawnStar(x, y) {
    const kind = pickKind();
    stars.push({
      x,
      y,
      kind,
      size: pickSize(kind),
      angle: Math.random() * Math.PI * 2,
      spin: rand(-0.07, 0.07),
      color: pickColor(),
      born: performance.now(),
      life: BASE_LIFE + rand(-180, 220),
      driftX: rand(-0.25, 0.25),
      driftY: rand(0.15, 0.55)
    });
    while (stars.length > MAX_STARS) stars.shift();
  }

  function addTrail(x, y) {
    if (lastX === null) {
      spawnStar(x, y);
      lastX = x;
      lastY = y;
      return;
    }

    const dx = x - lastX;
    const dy = y - lastY;
    const dist = Math.hypot(dx, dy);
    if (dist < MIN_STEP) return;

    const steps = Math.max(1, Math.floor(dist / MIN_STEP));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      spawnStar(lastX + dx * t, lastY + dy * t);
    }

    lastX = x;
    lastY = y;
  }

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  function frame(now) {
    ctx.clearRect(0, 0, width, height);

    for (let i = stars.length - 1; i >= 0; i--) {
      const star = stars[i];
      const age = now - star.born;
      if (age >= star.life) {
        stars.splice(i, 1);
        continue;
      }

      const t = age / star.life;
      const alpha = (1 - t) * (1 - t) * 0.95;
      star.x += star.driftX;
      star.y += star.driftY;
      star.angle += star.spin;
      drawStar(star, alpha);
    }

    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  window.addEventListener('mousemove', (e) => {
    addTrail(e.clientX + offsetX, e.clientY + offsetY);
  }, { passive: true });

  window.addEventListener('mouseleave', () => {
    lastX = null;
    lastY = null;
  });

  resize();
  window.addEventListener('resize', resize, { passive: true });
  requestAnimationFrame(frame);
})();
