let ctx: AudioContext | null = null;
let enabled = true;

export function setSound(on: boolean): void {
  enabled = on;
}

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.08, delay = 0, slide = 0): void {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export const sfx = {
  card() {
    tone(520, 0.07, 'triangle', 0.06);
    tone(780, 0.06, 'triangle', 0.04, 0.03);
  },
  open(dir: number) {
    tone(dir > 0 ? 440 : 330, 0.12, 'square', 0.035, 0, dir > 0 ? 220 : -120);
  },
  profit(v: number) {
    const n = Math.min(4, 1 + Math.floor(v / 6));
    for (let i = 0; i < n; i++) tone(660 + i * 180, 0.12, 'sine', 0.07, i * 0.05);
  },
  loss() {
    tone(200, 0.22, 'sawtooth', 0.04, 0, -80);
  },
  bar(up: boolean) {
    tone(up ? 300 : 240, 0.09, 'triangle', 0.05);
  },
  bad() {
    tone(150, 0.15, 'square', 0.04);
  },
  heat() {
    tone(900, 0.05, 'square', 0.03);
    tone(700, 0.05, 'square', 0.03, 0.06);
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', 0.07, i * 0.09));
  },
  fail() {
    [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.04, i * 0.12));
  },
  alarm() {
    for (let i = 0; i < 3; i++) tone(880, 0.12, 'square', 0.05, i * 0.18, -300);
  },
  buy() {
    tone(1200, 0.06, 'sine', 0.06);
    tone(1600, 0.08, 'sine', 0.05, 0.05);
  },
  click() {
    tone(400, 0.04, 'triangle', 0.04);
  },
};
