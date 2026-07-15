(function initGalaxy() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'galaxy-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  const particles = [];

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function createParticles() {
    particles.length = 0;
    const count = Math.min(160, Math.floor((width * height) / 9000));
    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: roll < 0.65 ? rand(0.6, 1.8) : rand(1.5, 3.2),
        kind: roll < 0.55 ? 'dot' : roll < 0.82 ? 'sparkle' : 'star',
        angle: Math.random() * Math.PI * 2,
        spin: rand(-0.025, 0.025),
        vx: rand(-0.12, 0.12),
        vy: rand(-0.12, 0.12),
        phase: Math.random() * Math.PI * 2,
        pulse: rand(0.4, 1.6),
        hue: roll < 0.2 ? 330 : 0
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

  function drawSparkle(x, y, size, angle, alpha, hue) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = hue ? 'rgba(232,143,178,' + alpha + ')' : 'rgba(120,120,140,' + alpha + ')';
    ctx.lineWidth = Math.max(0.6, size * 0.35);
    ctx.beginPath();
    ctx.moveTo(-size, 0);
    ctx.lineTo(size, 0);
    ctx.moveTo(0, -size);
    ctx.lineTo(0, size);
    ctx.stroke();
    ctx.restore();
  }

  function drawStar(x, y, size, angle, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(90,90,110,' + alpha + ')';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i;
      const r = i % 2 === 0 ? size : size * 0.35;
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

      const alpha = 0.08 + 0.35 * (0.5 + 0.5 * Math.sin(time * 0.001 * p.pulse + p.phase));

      if (p.kind === 'dot') {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.hue ? '#E88FB2' : '#888899';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'sparkle') {
        drawSparkle(p.x, p.y, p.size * 2.2, p.angle, alpha, p.hue);
      } else {
        drawStar(p.x, p.y, p.size * 1.6, p.angle, alpha);
      }
    });

    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);
  requestAnimationFrame(frame);
})();
