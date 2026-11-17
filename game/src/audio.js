// Every sound is synthesised with WebAudio — no audio files, nothing to load.
// A single lazy AudioContext (browsers need a user gesture first), one master gain,
// and a mute toggle that survives visits. Each effect is a short envelope over an
// oscillator, or filtered noise for the thuds.
import { MUTE_KEY } from './config.js';

function readMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = readMuted();

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone({ freq, end = null, type = 'sine', dur = 0.12, vol = 0.2, delay = 0 }) {
    if (muted || !ensure()) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (end !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({ dur = 0.15, vol = 0.25, freq = 800, delay = 0 }) {
    if (muted || !ensure()) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  return {
    /** Call on the first user gesture so later sounds are allowed. */
    unlock() {
      ensure();
    },
    isMuted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      try {
        window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        // Storage can be off: the toggle then lasts this visit only.
      }
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    click() {
      tone({ freq: 660, end: 880, type: 'triangle', dur: 0.07, vol: 0.15 });
    },
    shoot() {
      tone({ freq: 920, end: 620, type: 'triangle', dur: 0.06, vol: 0.05 });
    },
    pickup(combo) {
      const step = Math.min(combo, 12);
      tone({ freq: 520 * Math.pow(2, step / 12), end: null, type: 'sine', dur: 0.09, vol: 0.12 });
    },
    hit() {
      noise({ dur: 0.18, vol: 0.3, freq: 500 });
      tone({ freq: 140, end: 60, type: 'sawtooth', dur: 0.18, vol: 0.18 });
    },
    enemyDown() {
      tone({ freq: 300, end: 90, type: 'square', dur: 0.1, vol: 0.07 });
    },
    nova() {
      tone({ freq: 220, end: 660, type: 'sine', dur: 0.25, vol: 0.16 });
      noise({ dur: 0.2, vol: 0.08, freq: 2400 });
    },
    levelup() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.22, vol: 0.16, delay: i * 0.07 }));
    },
    boss() {
      tone({ freq: 90, end: 45, type: 'sawtooth', dur: 0.7, vol: 0.25 });
      tone({ freq: 180, end: 60, type: 'square', dur: 0.5, vol: 0.12, delay: 0.1 });
    },
    gameover() {
      [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.3, vol: 0.16, delay: i * 0.16 }));
    },
    victory() {
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.28, vol: 0.16, delay: i * 0.11 }));
    },
  };
}
