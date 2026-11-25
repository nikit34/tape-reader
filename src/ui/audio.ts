export type Mood = 'off' | 'menu' | 'trade' | 'boss' | 'shop' | 'win' | 'lose';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let echo: DelayNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let sfxOn = true;
let musicOn = true;
let wantMood: Mood = 'off';
let curMood: Mood = 'off';
let tension = 0;
let timer: number | null = null;
let nextStepTime = 0;
let step = 0;
let barIndex = 0;

const MUSIC_LEVEL = 0.2;

function ensure(): AudioContext | null {
  if (!sfxOn && !musicOn) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 4;
      master.connect(comp).connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = sfxOn ? 1 : 0;
      sfxBus.connect(master);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0;
      echo = ctx.createDelay(1);
      echo.delayTime.value = 0.28;
      const fb = ctx.createGain();
      fb.gain.value = 0.32;
      const wet = ctx.createGain();
      wet.gain.value = 0.35;
      echo.connect(fb).connect(echo);
      echo.connect(wet).connect(musicBus);
      musicBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function unlockAudio(): void {
  const a = ensure();
  if (a && musicOn && wantMood !== 'off') startScheduler();
}

export function setSound(on: boolean): void {
  sfxOn = on;
  if (ctx && sfxBus) sfxBus.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
}

export function setMusic(on: boolean): void {
  musicOn = on;
  if (!on) {
    if (ctx && musicBus) musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    return;
  }
  if (ctx) {
    startScheduler();
    applyMood();
  }
}

export function setMood(m: Mood): void {
  wantMood = m;
  if (ctx && musicOn) {
    startScheduler();
    applyMood();
  }
}

export function setTension(t: number): void {
  tension = Math.max(0, Math.min(1, t));
}

let hidden = false;
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    hidden = document.visibilityState === 'hidden';
    applyMood();
  });
}

function applyMood(): void {
  if (!ctx || !musicBus) return;
  const target = wantMood === 'off' || !musicOn || hidden ? 0 : MUSIC_LEVEL;
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setTargetAtTime(target, ctx.currentTime, 0.4);
}

interface MoodDef {
  bpm: number;
  root: number;
  chords: number[][];
  arp: number[];
  kick: number[];
  hat: number[];
  bass: number[];
  bright: number;
  wave: OscillatorType;
}

const MOODS: Record<Exclude<Mood, 'off'>, MoodDef> = {
  menu: {
    bpm: 80,
    root: 45,
    chords: [
      [0, 3, 7, 10],
      [-4, 0, 3, 7],
      [-2, 2, 5, 9],
      [-5, -2, 2, 5],
    ],
    arp: [0, -1, -1, 2, -1, -1, 1, -1, 3, -1, -1, 2, -1, 1, -1, -1],
    kick: [],
    hat: [],
    bass: [0, 8],
    bright: 900,
    wave: 'triangle',
  },
  trade: {
    bpm: 100,
    root: 50,
    chords: [
      [0, 3, 7, 10],
      [5, 9, 12, 15],
      [3, 7, 10, 14],
      [-2, 2, 5, 9],
    ],
    arp: [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 2, 1, 0, 3],
    kick: [0, 8],
    hat: [2, 6, 10, 14],
    bass: [0, 3, 8, 11],
    bright: 1400,
    wave: 'square',
  },
  boss: {
    bpm: 118,
    root: 52,
    chords: [
      [0, 3, 7, 10],
      [1, 5, 8, 12],
      [-2, 1, 5, 8],
      [0, 3, 7, 11],
    ],
    arp: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 3, 2, 1, 0],
    kick: [0, 4, 8, 12],
    hat: [2, 6, 10, 14, 3, 11],
    bass: [0, 2, 4, 6, 8, 10, 12, 14],
    bright: 1900,
    wave: 'sawtooth',
  },
  shop: {
    bpm: 92,
    root: 53,
    chords: [
      [0, 4, 7, 11],
      [5, 9, 12, 16],
      [2, 5, 9, 12],
      [7, 11, 14, 17],
    ],
    arp: [0, -1, 1, -1, 2, -1, 3, -1, 2, -1, 1, -1, 0, -1, 2, -1],
    kick: [0],
    hat: [4, 12],
    bass: [0, 7, 10],
    bright: 1600,
    wave: 'triangle',
  },
  win: {
    bpm: 96,
    root: 55,
    chords: [
      [0, 4, 7, 12],
      [5, 9, 12, 16],
      [7, 11, 14, 19],
      [0, 4, 7, 12],
    ],
    arp: [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 3, 1, 2, 3, -1],
    kick: [0, 8],
    hat: [4, 12],
    bass: [0, 8],
    bright: 2200,
    wave: 'triangle',
  },
  lose: {
    bpm: 70,
    root: 43,
    chords: [
      [0, 3, 7, 10],
      [-4, 0, 3, 7],
      [-5, -1, 2, 5],
      [-7, -4, 0, 3],
    ],
    arp: [0, -1, -1, -1, 2, -1, -1, -1, 1, -1, -1, -1, 3, -1, -1, -1],
    kick: [],
    hat: [],
    bass: [0],
    bright: 700,
    wave: 'triangle',
  },
};

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

function startScheduler(): void {
  if (!ctx || timer !== null) return;
  nextStepTime = ctx.currentTime + 0.05;
  timer = window.setInterval(schedule, 25);
}

function schedule(): void {
  if (!ctx) return;
  if (!musicOn || wantMood === 'off') {
    curMood = 'off';
    return;
  }
  if (step === 0 && curMood !== wantMood) {
    curMood = wantMood;
    barIndex = 0;
  }
  if (curMood === 'off') {
    curMood = wantMood;
    step = 0;
    barIndex = 0;
  }
  const m = MOODS[curMood as Exclude<Mood, 'off'>];
  const stepDur = 60 / m.bpm / 4;
  if (nextStepTime < ctx.currentTime - 0.2) nextStepTime = ctx.currentTime + 0.02;
  while (nextStepTime < ctx.currentTime + 0.12) {
    playStep(m, step, barIndex, nextStepTime, stepDur);
    nextStepTime += stepDur;
    step = (step + 1) % 16;
    if (step === 0) barIndex++;
  }
}

function playStep(m: MoodDef, st: number, bar: number, t: number, stepDur: number): void {
  if (!ctx || !musicBus) return;
  const chord = m.chords[bar % m.chords.length];
  const bright = m.bright + tension * 1400;
  if (st === 0) pad(chord.map((c) => m.root + 12 + c), t, stepDur * 16, bright * 0.6);
  const ai = m.arp[st];
  if (ai >= 0) {
    const note = m.root + 24 + chord[ai % chord.length] + (ai >= chord.length ? 12 : 0);
    pluck(midi(note), t, stepDur * 1.6, m.wave, bright, 0.05);
  }
  if (m.bass.includes(st)) bassNote(midi(m.root + chord[0] - 12), t, stepDur * 1.8);
  if (m.kick.includes(st)) kick(t);
  const hats = tension > 0.55 ? [...m.hat, 1, 5, 9, 13, 3, 7, 11, 15] : m.hat;
  if (hats.includes(st)) hat(t, st % 4 === 2 ? 0.05 : 0.03);
}

function pad(notes: number[], t: number, dur: number, cutoff: number): void {
  if (!ctx || !musicBus) return;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.05, t + dur * 0.25);
  g.gain.linearRampToValueAtTime(0.04, t + dur * 0.8);
  g.gain.linearRampToValueAtTime(0, t + dur * 1.02);
  f.connect(g).connect(musicBus);
  for (const n of notes) {
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(n);
      o.detune.value = det;
      o.connect(f);
      o.start(t);
      o.stop(t + dur * 1.05);
    }
  }
}

function pluck(freq: number, t: number, dur: number, wave: OscillatorType, cutoff: number, level: number): void {
  if (!ctx || !musicBus || !echo) return;
  const o = ctx.createOscillator();
  o.type = wave;
  o.frequency.value = freq;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(cutoff * 1.6, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(200, cutoff * 0.4), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g);
  g.connect(musicBus);
  g.connect(echo);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function bassNote(freq: number, t: number, dur: number): void {
  if (!ctx || !musicBus) return;
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.16, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(musicBus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function kick(t: number): void {
  if (!ctx || !musicBus) return;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(130, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.32, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(g).connect(musicBus);
  o.start(t);
  o.stop(t + 0.22);
}

function hat(t: number, level: number): void {
  if (!ctx || !musicBus || !noiseBuf) return;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  s.connect(f).connect(g).connect(musicBus);
  s.start(t, Math.random() * 0.5);
  s.stop(t + 0.05);
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.08, delay = 0, slide = 0): void {
  const a = ensure();
  if (!a || !sfxBus || !sfxOn) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(sfxBus);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur: number, gain: number, from: number, to: number, delay = 0, type: BiquadFilterType = 'bandpass'): void {
  const a = ensure();
  if (!a || !sfxBus || !noiseBuf || !sfxOn) return;
  const t0 = a.currentTime + delay;
  const s = a.createBufferSource();
  s.buffer = noiseBuf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(60, to), t0 + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f).connect(g).connect(sfxBus);
  s.start(t0, Math.random() * 0.4);
  s.stop(t0 + dur + 0.02);
}

function bellTone(base: number, gain: number, delay = 0, dur = 1.4): void {
  [1, 2.76, 5.4, 8.93].forEach((r, i) => tone(base * r, dur / (1 + i * 0.6), 'sine', gain / (1 + i * 1.5), delay));
}

let lastHover = 0;

export const sfx = {
  card() {
    noise(0.09, 0.12, 1800, 5200);
    tone(620, 0.06, 'triangle', 0.04, 0.01);
  },
  deal() {
    for (let i = 0; i < 3; i++) noise(0.05, 0.05, 2500, 4000, i * 0.045);
  },
  hover() {
    const now = performance.now();
    if (now - lastHover < 60) return;
    lastHover = now;
    tone(1500, 0.025, 'sine', 0.012);
  },
  open(dir: number) {
    if (dir > 0) tone(392, 0.14, 'square', 0.03, 0, 300);
    else tone(523, 0.14, 'square', 0.03, 0, -260);
  },
  profit(v: number) {
    const n = Math.min(5, 1 + Math.floor(v / 5));
    for (let i = 0; i < n; i++) {
      tone(1318 + i * 90, 0.18, 'sine', 0.055, i * 0.055);
      tone(1760 + i * 120, 0.12, 'sine', 0.03, i * 0.055 + 0.02);
    }
  },
  loss(v: number) {
    tone(180, 0.28, 'sawtooth', 0.035, 0, -90);
    if (v <= -6) tone(120, 0.35, 'sine', 0.08, 0.05, -50);
  },
  bar(move: number) {
    noise(0.03, 0.08, 3000, 3000, 0, 'highpass');
    const base = move > 0 ? 330 : move < 0 ? 247 : 288;
    tone(base, 0.12, 'triangle', 0.05, 0.01, move > 0 ? 60 : move < 0 ? -50 : 0);
    if (Math.abs(move) >= 5) tone(base / 2, 0.25, 'sawtooth', 0.03, 0.02, move > 0 ? 80 : -60);
  },
  news(up: boolean) {
    tone(up ? 587 : 466, 0.16, 'sawtooth', 0.04);
    tone(up ? 880 : 349, 0.24, 'sawtooth', 0.04, 0.12);
  },
  bad() {
    tone(140, 0.12, 'square', 0.035);
    tone(110, 0.14, 'square', 0.035, 0.07);
  },
  heat() {
    tone(980, 0.05, 'square', 0.025);
    tone(760, 0.06, 'square', 0.025, 0.06);
  },
  quota() {
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.22, 'triangle', 0.06, i * 0.07));
  },
  danger() {
    tone(70, 0.12, 'sine', 0.12);
    tone(66, 0.14, 'sine', 0.1, 0.18);
  },
  bell() {
    bellTone(660, 0.12);
    bellTone(660, 0.08, 0.35);
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, 'triangle', 0.07, i * 0.1));
    tone(1046, 0.6, 'sine', 0.04, 0.42);
  },
  fail() {
    [392, 330, 277, 220].forEach((f, i) => tone(f, 0.32, 'sawtooth', 0.035, i * 0.14));
  },
  alarm() {
    for (let i = 0; i < 4; i++) tone(920, 0.13, 'square', 0.045, i * 0.2, -340);
  },
  buy() {
    noise(0.06, 0.12, 4000, 2000);
    bellTone(1318, 0.05, 0.04, 0.6);
  },
  reroll() {
    for (let i = 0; i < 5; i++) noise(0.04, 0.05, 1500 + i * 400, 2500, i * 0.035);
  },
  reward() {
    tone(659, 0.15, 'triangle', 0.05);
    tone(988, 0.2, 'triangle', 0.05, 0.08);
  },
  boss() {
    tone(82, 0.9, 'sawtooth', 0.05, 0, -20);
    tone(123, 0.9, 'sawtooth', 0.035, 0.05, -20);
    noise(0.8, 0.06, 300, 120, 0, 'lowpass');
  },
  victory() {
    [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => tone(f, 0.35, 'triangle', 0.06, i * 0.12));
    bellTone(1046, 0.06, 0.9, 1.6);
  },
  click() {
    tone(420, 0.035, 'triangle', 0.03);
  },
};
