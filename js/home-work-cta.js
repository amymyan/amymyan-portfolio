(function initHomeWorkCta() {
  const link = document.querySelector('.home-work-cta');
  const textEl = document.querySelector('.home-work-cta-text');
  if (!link || !textEl) return;

  const TEXT = "let's work!";
  const TYPE_MS = 88;
  const GLOW_MS = 500;
  const FADE_MS = 280;
  const REST_MS = 350;

  let timerId = null;

  function clearTimer() {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  function schedule(fn, delay) {
    clearTimer();
    timerId = setTimeout(fn, delay);
  }

  function runLoop() {
    textEl.textContent = '';
    link.classList.remove('is-complete', 'is-glowing', 'is-hidden');

    let index = 0;

    function typeNext() {
      if (index < TEXT.length) {
        textEl.textContent = TEXT.slice(0, index + 1);
        index += 1;
        schedule(typeNext, TYPE_MS);
        return;
      }

      link.classList.add('is-complete', 'is-glowing');
      schedule(() => {
        link.classList.add('is-hidden');
        schedule(() => {
          textEl.textContent = '';
          link.classList.remove('is-complete', 'is-glowing', 'is-hidden');
          schedule(runLoop, REST_MS);
        }, FADE_MS);
      }, GLOW_MS);
    }

    typeNext();
  }

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    textEl.textContent = TEXT;
    textEl.removeAttribute('aria-hidden');
    link.classList.add('is-complete');
    link.querySelector('.visually-hidden')?.remove();
    return;
  }

  runLoop();
})();
