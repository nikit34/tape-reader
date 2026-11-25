import type { Rng } from './types';

export function makeRng(seed: number): Rng {
  return { s: seed >>> 0 || 1 };
}

export function rnd(r: Rng): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(r: Rng, a: number, b: number): number {
  return a + Math.floor(rnd(r) * (b - a + 1));
}

export function pick<T>(r: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rnd(r) * arr.length)];
}

export function shuffle<T>(r: Rng, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd(r) * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function weighted<T>(r: Rng, items: readonly T[], weight: (t: T) => number): T {
  let total = 0;
  for (const it of items) total += weight(it);
  let x = rnd(r) * total;
  for (const it of items) {
    x -= weight(it);
    if (x <= 0) return it;
  }
  return items[items.length - 1];
}

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function newSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) ^ Date.now()) >>> 0;
}
