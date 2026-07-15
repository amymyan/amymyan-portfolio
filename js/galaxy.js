(function initGalaxy() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'galaxy-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  const PINKS = ['#B8437A', '#C95888', '#D66A96', '#E88FB2'];
  let width = 0;
  let height = 0;
  const particles = [];

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pickPink() {
    return PINKS[Math.floor(Math.random() * PINKS.length)];
  }

  function createParticles() {
    particles.length = 0;
    const count = Math.min(180, Math.floor((width * height) / 8000));
    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: roll < 0.5 ? rand(1, 2.4) : rand(2, 4.5),
        kind: roll < 0.45 ? 'dot' : roll < 0.78 ? 'sparkle' : 'star',
        angle: Math.random() * Math.PI * 2,
        spin: rand(-0.03, 0.03),
        vx: rand(-0.14, 0.14),
        vy: rand(-0.14, 0.14),
        phase: Math.random() * Math.PI * 2,
        pulse: rand(0.5, 1.8),
        color: pickPink()
      });
    }
  }

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    createParticles();
  }

  function wrap(p) {
    if (p.x < -20) p.x = width + 20;
    if (p.x > width + 20) p.x = -20;
    if (p.y < -20) p.y = height + 20;
    if (p.y > height + 20) p.y = -20;
  }

  function drawSparkle(x, y, size, angle, alpha, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, size * 0.45);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-size, 0);
    ctx.lineTo(size, 0);
    ctx.moveTo(0, -size);
    ctx.lineTo(0, size);
    ctx.stroke();
    ctx.restore();
  }

  function drawStar(x, y, size, angle, alpha, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i;
      const r = i % 2 === 0 ? size : size * 0.38;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
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

      const alpha = 0.28 + 0.52 * (0.5 + 0.5 * Math.sin(time * 0.001 * p.pulse + p.phase));

      if (p.kind === 'dot') {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'sparkle') {
        drawSparkle(p.x, p.y, p.size * 2.4, p.angle, alpha, p.color);
      } else {
        drawStar(p.x, p.y, p.size * 1.7, p.angle, alpha, p.color);
      }
    });

    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(frame);
})();
