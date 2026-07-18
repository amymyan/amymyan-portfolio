(function initGalaxy() {
  if (document.body.classList.contains('organizer')) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'galaxy-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  const PINK = getComputedStyle(document.documentElement)
    .getPropertyValue('--flash').trim() || '#E88FB2';

  let width = 0;
  let height = 0;
  const particles = [];

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pickKind() {
    const roll = Math.random();
    if (roll < 0.3) return 'dot';
    if (roll < 0.55) return 'star5';
    if (roll < 0.78) return 'star6';
    return 'diamond4';
  }

  function pickSize(kind) {
    if (kind === 'dot') return rand(0.8, 2.8);
    if (kind === 'star5') return rand(2.5, 6);
    if (kind === 'star6') return rand(2.8, 6.5);
    return rand(3, 7);
  }

  function createParticles() {
    particles.length = 0;
    const count = Math.min(180, Math.floor((width * height) / 8000));
    for (let i = 0; i < count; i++) {
      const kind = pickKind();
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: pickSize(kind),
        kind,
        angle: Math.random() * Math.PI * 2,
        spin: rand(-0.025, 0.025),
        vx: rand(-0.14, 0.14),
        vy: rand(-0.14, 0.14),
        phase: Math.random() * Math.PI * 2,
        pulse: rand(0.5, 1.8)
      });
    }
  }

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    createParticles();
  }

  function wrap(p) {
    if (p.x < -24) p.x = width + 24;
    if (p.x > width + 24) p.x = -24;
    if (p.y < -24) p.y = height + 24;
    if (p.y > height + 24) p.y = -24;
  }

  function polygonStar(points, outer, inner, rotation) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = rotation + (Math.PI / points) * i - Math.PI / 2;
      const r = i % 2 === 0 ? outer : inner;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawDot(x, y, size, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = PINK;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStar5(x, y, size, angle, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = PINK;
    polygonStar(5, size, size * 0.42, 0);
    ctx.fill();
    ctx.restore();
  }

  function drawStar6(x, y, size, angle, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = PINK;
    polygonStar(6, size, size * 0.48, 0);
    ctx.fill();
    ctx.restore();
  }

  function drawDiamond4(x, y, size, angle, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = PINK;
    polygonStar(4, size, size * 0.28, Math.PI / 4);
    ctx.fill();
    ctx.restore();
  }

  function frame(time) {
    ctx.clearRect(0, 0, width, height);

    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;
      wrap(p);

      const alpha = 0.22 + 0.58 * (0.5 + 0.5 * Math.sin(time * 0.001 * p.pulse + p.phase));

      if (p.kind === 'dot') {
        drawDot(p.x, p.y, p.size, alpha);
      } else if (p.kind === 'star5') {
        drawStar5(p.x, p.y, p.size, p.angle, alpha);
      } else if (p.kind === 'star6') {
        drawStar6(p.x, p.y, p.size, p.angle, alpha);
      } else {
        drawDiamond4(p.x, p.y, p.size, p.angle, alpha);
      }
    });

    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(frame);
})();
