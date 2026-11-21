// Synthesized sound and music (no audio files). A cozy candlelit-tavern band: plucked lute, recorder, frame drum.
// Knead schedules its beats on this clock (audio.time()), so taps are judged against what you hear.

type Wave = OscillatorType;

class Audio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  musicVol = 0.55;
  sfxVol = 0.8;
  /** user calibration for Knead, ms (added to the output latency) */
  offsetMs = 0;
  private track = '';
  private seqTimer = 0;
  private nextBeat = 0;
  private beatN = 0;
  private bpm = 96;
  private duck = 1;

  unlock(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this.musicVol * 0.5;
      this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this.sfxVol;
      this.sfxBus.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) void this.ctx.suspend();
        else void this.ctx.resume();
      });
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVol = music;
    this.sfxVol = sfx;
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(music * 0.5 * this.duck, this.ctx.currentTime, 0.05);
    this.sfxBus.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
  }

  /** the audio clock in seconds (what you hear, minus output latency and your calibration) */
  time(): number {
    if (!this.ctx) return performance.now() / 1000;
    return this.ctx.currentTime;
  }
  latency(): number {
    if (!this.ctx) return 0;
    const ol = (this.ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
    return (ol || this.ctx.baseLatency || 0) + this.offsetMs / 1000;
  }

  // ------------------------------------------------------------------ building blocks

  private tone(freq: number, dur: number, opts: { wave?: Wave; vol?: number; when?: number; attack?: number; bus?: 'sfx' | 'music'; slide?: number; filter?: number; vibrato?: number } = {}): void {
    const c = this.ctx;
    if (!c) return;
    const t = opts.when ?? c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = opts.wave ?? 'triangle';
    o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opts.slide), t + dur);
    const vol = opts.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (opts.attack ?? 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (opts.filter) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.filter;
      o.connect(f);
      node = f;
    }
    if (opts.vibrato) {
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 5.5;
      lg.gain.value = opts.vibrato;
      lfo.connect(lg);
      lg.connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
    }
    node.connect(g);
    g.connect(opts.bus === 'music' ? this.musicBus : this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, opts: { vol?: number; when?: number; freq?: number; q?: number; type?: BiquadFilterType; bus?: 'sfx' | 'music'; attack?: number } = {}): void {
    const c = this.ctx;
    if (!c || !this.noiseBuf) return;
    const t = opts.when ?? c.currentTime;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.value = opts.freq ?? 1200;
    f.Q.value = opts.q ?? 1;
    const g = c.createGain();
    const vol = opts.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (opts.attack ?? 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(opts.bus === 'music' ? this.musicBus : this.sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  /** a plucked lute note */
  pluck(freq: number, when?: number, vol = 0.22, bus: 'sfx' | 'music' = 'music'): void {
    this.tone(freq, 0.6, { wave: 'triangle', vol, when, bus, filter: 2400 });
    this.tone(freq * 2, 0.25, { wave: 'sine', vol: vol * 0.3, when, bus });
  }
  /** the frame drum */
  drum(when?: number, vol = 0.35, bus: 'sfx' | 'music' = 'music', low = true): void {
    this.tone(low ? 90 : 170, 0.18, { wave: 'sine', vol, when, bus, slide: 0.5 });
    this.noise(0.06, { vol: vol * 0.35, when, freq: low ? 400 : 2500, bus });
  }

  // ------------------------------------------------------------------ sound effects

  sfx(name: string, v = 1): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'tap':
        this.tone(660, 0.06, { wave: 'square', vol: 0.05 * v, filter: 1800 });
        break;
      case 'hover':
        this.tone(880, 0.04, { wave: 'sine', vol: 0.03 * v });
        break;
      case 'select':
        this.pluck(523, t, 0.18, 'sfx');
        this.pluck(784, t + 0.06, 0.14, 'sfx');
        break;
      case 'back':
        this.pluck(392, t, 0.16, 'sfx');
        this.pluck(294, t + 0.06, 0.12, 'sfx');
        break;
      case 'perfect':
        this.tone(1318, 0.18, { wave: 'sine', vol: 0.16 * v });
        this.tone(1976, 0.22, { wave: 'sine', vol: 0.08 * v, when: t + 0.04 });
        break;
      case 'good':
        this.tone(988, 0.12, { wave: 'sine', vol: 0.12 * v });
        break;
      case 'miss':
        this.tone(140, 0.16, { wave: 'sawtooth', vol: 0.08 * v, filter: 500, slide: 0.7 });
        break;
      case 'thump':
        this.drum(t, 0.4 * v, 'sfx');
        break;
      case 'squish':
        this.noise(0.14, { vol: 0.12 * v, freq: 500, q: 2 });
        this.tone(220, 0.12, { wave: 'sine', vol: 0.1 * v, slide: 0.6 });
        break;
      case 'rise':
        this.tone(300 + v * 500, 0.08, { wave: 'sine', vol: 0.05 });
        break;
      case 'collapse':
        this.tone(320, 0.5, { wave: 'triangle', vol: 0.16, slide: 0.3 });
        this.noise(0.3, { vol: 0.1, freq: 300 });
        break;
      case 'nat20':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.35, { wave: 'triangle', vol: 0.14, when: t + i * 0.06 }));
        break;
      case 'pour':
        this.noise(0.12, { vol: 0.05 * v, freq: 2500 + v * 1500, q: 0.7, type: 'highpass' });
        break;
      case 'ding':
        this.tone(1568, 0.6, { wave: 'sine', vol: 0.16 });
        this.tone(2093, 0.5, { wave: 'sine', vol: 0.06, when: t + 0.01 });
        break;
      case 'load':
        this.noise(0.18, { vol: 0.12, freq: 900, q: 0.8 });
        this.tone(180, 0.15, { wave: 'square', vol: 0.05, filter: 700 });
        break;
      case 'pull':
        this.noise(0.12, { vol: 0.1, freq: 1400 });
        this.tone(740, 0.14, { wave: 'triangle', vol: 0.12 });
        break;
      case 'parry':
        this.tone(1760, 0.08, { wave: 'square', vol: 0.08, filter: 5000 });
        this.tone(2637, 0.3, { wave: 'sine', vol: 0.12, when: t + 0.02 });
        this.noise(0.05, { vol: 0.15, freq: 6000, type: 'highpass' });
        break;
      case 'sizzle':
        this.noise(0.5, { vol: 0.08, freq: 5000, type: 'highpass' });
        break;
      case 'burn':
        this.noise(0.6, { vol: 0.14, freq: 700 });
        this.tone(110, 0.5, { wave: 'sawtooth', vol: 0.06, filter: 400, slide: 0.6 });
        break;
      case 'bump':
        this.drum(t, 0.3, 'sfx', false);
        break;
      case 'pipe':
        this.noise(0.08, { vol: 0.03 * v, freq: 800 + v * 400, q: 3 });
        break;
      case 'coin':
        this.tone(1318, 0.08, { wave: 'square', vol: 0.05, filter: 4000 });
        this.tone(1976, 0.2, { wave: 'square', vol: 0.05, filter: 4000, when: t + 0.06 });
        break;
      case 'star':
        this.tone(1046 + v * 60, 0.25, { wave: 'sine', vol: 0.1 });
        break;
      case 'loaf':
        this.tone(392 + v * 30, 0.1, { wave: 'triangle', vol: 0.12 });
        this.noise(0.05, { vol: 0.05, freq: 1500 });
        break;
      case 'thirteenth':
        [784, 988, 1175, 1568].forEach((f, i) => this.pluck(f, t + i * 0.08, 0.2, 'sfx'));
        this.tone(2093, 0.8, { wave: 'sine', vol: 0.08, when: t + 0.32, vibrato: 6 });
        break;
      case 'crack':
        this.noise(0.25, { vol: 0.3, freq: 2000, q: 0.6 });
        this.tone(80, 0.4, { wave: 'sine', vol: 0.3, slide: 0.5 });
        break;
      case 'filled':
        [523, 659, 784].forEach((f, i) => this.pluck(f, t + i * 0.07, 0.2, 'sfx'));
        break;
      case 'bell':
        this.tone(880, 1.2, { wave: 'sine', vol: 0.14 });
        this.tone(1320, 1, { wave: 'sine', vol: 0.06 });
        this.tone(2217, 0.6, { wave: 'sine', vol: 0.03 });
        break;
      case 'knock':
        this.drum(t, 0.35, 'sfx', false);
        this.drum(t + 0.22, 0.35, 'sfx', false);
        this.drum(t + 0.44, 0.45, 'sfx', false);
        break;
      case 'buy':
        this.tone(988, 0.08, { wave: 'square', vol: 0.05, filter: 3000 });
        this.pluck(1318, t + 0.05, 0.15, 'sfx');
        break;
      case 'flour':
        this.noise(0.6, { vol: 0.16, freq: 1200, q: 0.4, attack: 0.03 });
        break;
      case 'salt':
        for (let i = 0; i < 6; i++) this.noise(0.03, { vol: 0.1, freq: 7000, type: 'highpass', when: t + i * 0.05 });
        break;
      case 'swap':
        this.tone(400, 0.3, { wave: 'triangle', vol: 0.1, slide: 2.5 });
        break;
      case 'ghost':
        this.tone(330, 1.2, { wave: 'sine', vol: 0.05, vibrato: 12, attack: 0.3 });
        break;
      case 'emote':
        this.tone(1046, 0.08, { wave: 'sine', vol: 0.08 });
        this.tone(1318, 0.1, { wave: 'sine', vol: 0.06, when: t + 0.05 });
        break;
      case 'achievement':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.4, { wave: 'triangle', vol: 0.13, when: t + i * 0.09 }));
        this.tone(1568, 0.9, { wave: 'sine', vol: 0.08, when: t + 0.36, vibrato: 5 });
        break;
      case 'hearth':
        // a bonfire catching: a whoosh, a low swell, and the old two-note chime
        this.noise(1.2, { vol: 0.22, freq: 300, q: 0.4, attack: 0.25 });
        this.tone(110, 2.5, { wave: 'sine', vol: 0.18, attack: 0.6 });
        this.tone(659, 1.6, { wave: 'sine', vol: 0.08, when: t + 0.8 });
        this.tone(988, 2, { wave: 'sine', vol: 0.06, when: t + 1.1 });
        break;
      case 'tick':
        this.tone(1200, 0.03, { wave: 'square', vol: 0.03, filter: 3000 });
        break;
      case 'count':
        this.tone(660, 0.12, { wave: 'triangle', vol: 0.14 });
        break;
      case 'go':
        this.tone(990, 0.25, { wave: 'triangle', vol: 0.16 });
        this.tone(1320, 0.3, { wave: 'sine', vol: 0.08 });
        break;
      case 'win':
        [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.pluck(f, t + i * 0.11, 0.22, 'sfx'));
        break;
      case 'lose':
        [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.5, { wave: 'triangle', vol: 0.12, when: t + i * 0.22 }));
        break;
    }
  }

  // ------------------------------------------------------------------ music

  /** 'menu' | 'bakery' | 'game' | 'dawn' | 'results' | '' (silence) */
  music(track: string): void {
    this.unlock();
    if (track === this.track) return;
    this.track = track;
    clearInterval(this.seqTimer);
    if (!this.ctx || !track) return;
    this.bpm = { menu: 84, bakery: 96, game: 112, dawn: 126, results: 100 }[track] ?? 96;
    this.nextBeat = this.ctx.currentTime + 0.1;
    this.beatN = 0;
    this.seqTimer = window.setInterval(() => this.schedule(), 40);
  }

  /** quieter music while a rhythm game brings its own beat */
  duckMusic(on: boolean): void {
    this.duck = on ? 0.25 : 1;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(this.musicVol * 0.5 * this.duck, this.ctx.currentTime, 0.15);
  }

  private schedule(): void {
    const c = this.ctx;
    if (!c) return;
    const spb = 60 / this.bpm / 2; // eighth notes
    // D dorian, a tavern tune that wanders between four chords
    const scale = [146.8, 164.8, 174.6, 196, 220, 246.9, 261.6, 293.7, 329.6, 349.2, 392, 440];
    const chords = [
      [0, 2, 4],
      [3, 5, 7],
      [4, 6, 8],
      [2, 4, 6],
    ];
    // the page stalled (a long task, a background tab): skip ahead to the next beat instead of playing the backlog
    if (this.nextBeat < c.currentTime) {
      const skip = Math.ceil((c.currentTime - this.nextBeat) / spb);
      this.nextBeat += skip * spb;
      this.beatN += skip;
    }
    while (this.nextBeat < c.currentTime + 0.4) {
      const n = this.beatN;
      const t = this.nextBeat;
      const bar = Math.floor(n / 8) % 4;
      const ch = chords[this.track === 'dawn' ? (bar + 1) % 4 : bar]!;
      const step = n % 8;
      // lute arpeggio
      if (this.track !== 'menu' || step % 2 === 0) this.pluck(scale[ch[step % 3]!]!, t, step === 0 ? 0.2 : 0.12);
      // frame drum
      if (step === 0 || step === 4) this.drum(t, 0.22);
      if (this.track !== 'menu' && (step === 3 || step === 7)) this.drum(t, 0.1, 'music', false);
      // recorder melody every other bar
      if (Math.floor(n / 8) % 2 === 1 && (step === 0 || step === 3 || step === 6)) {
        const mel = scale[(ch[(n * 7) % 3]! + 7) % scale.length]! * 2;
        this.tone(mel, spb * 2.6, { wave: 'sine', vol: 0.06, when: t, attack: 0.04, bus: 'music', vibrato: 3 });
      }
      // bass on the bar
      if (step === 0) this.tone(scale[ch[0]!]! / 2, spb * 7, { wave: 'triangle', vol: 0.14, when: t, bus: 'music', filter: 600 });
      this.nextBeat += spb;
      this.beatN++;
    }
  }
}

export const audio = new Audio();
