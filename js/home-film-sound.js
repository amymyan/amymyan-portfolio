/* Film advance sounds — Web Audio, no asset files needed */

const HomeFilmSound = (function initHomeFilmSound() {
  let ctx = null;
  let scrubSession = null;

  function getCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function playTone({ freqStart, freqEnd, duration, type, volume, when = 0 }) {
    const c = getCtx();
    const t = c.currentTime + when;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + duration);
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  function playNoise({ duration, volume, when = 0, filterFreq = 1200 }) {
    const c = getCtx();
    const t = c.currentTime + when;
    const len = Math.floor(c.sampleRate * duration);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filter = c.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = filterFreq;
    const gain = c.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(gain).connect(c.destination);
    src.start(t);
    src.stop(t + duration + 0.01);
  }

  function click() {
    playNoise({ duration: 0.007, volume: 0.13, filterFreq: 1600 });
    playTone({ freqStart: 420, freqEnd: 260, duration: 0.01, type: 'square', volume: 0.035 });
  }

  return {
    advance() {
      try {
        playNoise({ duration: 0.028, volume: 0.24, filterFreq: 850 });
        playTone({ freqStart: 240, freqEnd: 85, duration: 0.055, type: 'square', volume: 0.09 });
        playTone({ freqStart: 540, freqEnd: 160, duration: 0.038, type: 'triangle', volume: 0.065, when: 0.012 });
      } catch { /* audio blocked or unsupported */ }
    },

    startScrub() {
      scrubSession = { lastFrame: null };
    },

    tickScrub(frameIndex) {
      if (!scrubSession) return;
      try {
        const frame = Math.floor(frameIndex);
        if (scrubSession.lastFrame === frame) return;
        scrubSession.lastFrame = frame;
        click();
      } catch { /* ignore */ }
    },

    stopScrub() {
      scrubSession = null;
    },

    land() {
      try {
        playNoise({ duration: 0.02, volume: 0.16, filterFreq: 550 });
        playTone({ freqStart: 150, freqEnd: 65, duration: 0.045, type: 'sine', volume: 0.11 });
      } catch { /* audio blocked or unsupported */ }
    }
  };
})();
