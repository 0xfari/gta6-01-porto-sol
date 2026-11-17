// All sound is synthesised with WebAudio — no audio files, no network. Engine
// hum, sirens, gunshots, punches, pickups and a lazy sunset music loop.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let sirenNodes = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      // Engine hum: a low sawtooth whose pitch follows the car's speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch { /* audio is cosmetic */ }
  }

  function noise(dur, vol, freq) {
    if (!ctx || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq || 1200;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.25;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch { /* audio is cosmetic */ }
  }

  // A lazy sunset chord loop: Am – F – C – G arpeggios, one note every 0.22 s.
  const CHORDS = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 196, 246.9]];
  let chordIdx = 0;
  let noteIdx = 0;
  function startMusic() {
    if (musicTimer || !ctx) return;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx) return;
      const chord = CHORDS[chordIdx % CHORDS.length];
      tone(chord[noteIdx % chord.length] * 2, 0.5, 'triangle', 0.045);
      noteIdx += 1;
      if (noteIdx % 6 === 0) chordIdx += 1;
    }, 220);
  }

  function startSiren() {
    if (sirenNodes || !ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 700;
      const gain = ctx.createGain();
      gain.gain.value = 0.04;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.7;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 220;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      lfo.start();
      sirenNodes = { osc, lfo, gain };
      window.setTimeout(() => stopSiren(), 9000);
    } catch { /* audio is cosmetic */ }
  }

  function stopSiren() {
    if (!sirenNodes) return;
    try {
      sirenNodes.gain.gain.setValueAtTime(0, ctx.currentTime);
      sirenNodes.osc.stop(ctx.currentTime + 0.1);
      sirenNodes.lfo.stop(ctx.currentTime + 0.1);
    } catch { /* already stopped */ }
    sirenNodes = null;
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
      startMusic();
    },
    engine(speed01) {
      if (!ctx || !engineGain || muted) return;
      try {
        engineGain.gain.setTargetAtTime(0.02 + speed01 * 0.05, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(50 + speed01 * 140, ctx.currentTime, 0.1);
      } catch { /* audio is cosmetic */ }
    },
    engineOff() {
      if (engineGain && ctx) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    },
    play(name) {
      if (!ensure()) return;
      if (name === 'shoot') noise(0.12, 0.3, 2400);
      else if (name === 'enemyShoot') noise(0.1, 0.16, 1800);
      else if (name === 'punch') noise(0.08, 0.3, 500);
      else if (name === 'crash') noise(0.3, 0.4, 700);
      else if (name === 'pickup') { tone(660, 0.12, 'sine', 0.18); tone(990, 0.18, 'sine', 0.15); }
      else if (name === 'steal') { tone(300, 0.15, 'square', 0.1, 520); }
      else if (name === 'mission') { tone(523, 0.15, 'triangle', 0.15); tone(659, 0.15, 'triangle', 0.15); tone(784, 0.25, 'triangle', 0.15); }
      else if (name === 'complete') { tone(523, 0.12, 'triangle', 0.16); tone(659, 0.12, 'triangle', 0.16); tone(784, 0.12, 'triangle', 0.16); tone(1046, 0.3, 'triangle', 0.18); }
      else if (name === 'siren') startSiren();
      else if (name === 'gameover') { tone(392, 0.3, 'sawtooth', 0.12, 180); }
      else if (name === 'win') { tone(523, 0.2, 'triangle', 0.16); tone(659, 0.2, 'triangle', 0.16); tone(784, 0.2, 'triangle', 0.16); tone(1046, 0.5, 'triangle', 0.18); }
    },
    toggleMute() {
      muted = !muted;
      if (muted) stopSiren();
      if (engineGain && ctx) engineGain.gain.value = 0;
      return muted;
    },
    isMuted() { return muted; },
  };
}
