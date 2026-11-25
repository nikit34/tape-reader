import { useEffect, useRef, useState } from 'preact/hooks';
import type { Candle, SessionState } from '../engine/types';
import { hiddenHeadline, shownMove } from '../engine/ops';
import { isNewsVisible } from '../engine/game';
import type { Preview } from '../engine/preview';

const C = {
  bg: '#0d131a',
  grid: 'rgba(140,170,200,0.08)',
  gridText: 'rgba(160,180,200,0.55)',
  up: '#2ee59d',
  down: '#ff5c7a',
  flat: '#8a98a8',
  violet: '#b388ff',
  amber: '#ffc857',
  slot: 'rgba(255,255,255,0.025)',
  slotLine: 'rgba(140,170,200,0.18)',
  next: 'rgba(76,201,240,0.75)',
  text: '#d7e1ea',
  price: '#4cc9f0',
};

function ease(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

function drawRound(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function render(ctx: CanvasRenderingContext2D, s: SessionState, w: number, h: number, p: number, pv: Preview | null) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, w, h);

  const nPre = s.pre.length;
  const slots = nPre + s.bars;
  const padL = 6;
  const padR = 58;
  const padT = 34;
  const padB = 22;
  const cw = (w - padL - padR) / slots;
  const xc = (i: number) => padL + cw * (i + 0.5);

  const candles: Candle[] = [...s.pre, ...s.candles];
  let lastPrice = s.price;
  if (p < 1 && s.candles.length) {
    const last = s.candles[s.candles.length - 1];
    const e = ease(p);
    const c = last.o + (last.c - last.o) * e;
    const hi = Math.max(last.o, c) + (last.h - Math.max(last.o, last.c)) * e;
    const lo = Math.min(last.o, c) - (Math.min(last.o, last.c) - last.l) * e;
    candles[candles.length - 1] = { o: last.o, c, h: hi, l: lo };
    lastPrice = c;
  }

  let min = Infinity;
  let max = -Infinity;
  for (const k of [...s.pre, ...s.candles]) {
    min = Math.min(min, k.l);
    max = Math.max(max, k.h);
  }
  for (const t of s.trades) {
    min = Math.min(min, t.entry);
    max = Math.max(max, t.entry);
  }
  min = Math.min(min, s.price);
  max = Math.max(max, s.price);
  if (pv) {
    if (pv.nudge) {
      min = Math.min(min, s.price + pv.nudge - 2);
      max = Math.max(max, s.price + pv.nudge + 2);
    }
    for (const g of pv.ghosts) {
      if (g.kind === 'straddle') {
        const need = 3 / Math.max(1, g.size);
        min = Math.min(min, s.price - need - 2);
        max = Math.max(max, s.price + need + 2);
      }
    }
  }
  const span = Math.max(14, max - min);
  const mid = (max + min) / 2;
  min = mid - span * 0.62;
  max = mid + span * 0.62;
  const plotH = h - padT - padB;
  const y = (v: number) => padT + ((max - v) / (max - min)) * plotH;

  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textBaseline = 'middle';
  const stepRaw = (max - min) / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(stepRaw)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((m) => m >= stepRaw) ?? stepRaw;
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) {
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, Math.round(y(v)) + 0.5);
    ctx.lineTo(w - padR, Math.round(y(v)) + 0.5);
    ctx.stroke();
    ctx.fillStyle = C.gridText;
    ctx.textAlign = 'left';
    ctx.fillText(String(Math.round(s.base + v)), w - padR + 8, y(v));
  }

  const sepX = padL + cw * nPre;
  ctx.strokeStyle = 'rgba(255,200,87,0.35)';
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(sepX, padT - 6);
  ctx.lineTo(sepX, h - padB);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,200,87,0.7)';
  ctx.textAlign = 'left';
  ctx.font = '600 10px "JetBrains Mono", monospace';
  ctx.fillText('OPEN', sepX + 4, padT - 22);

  for (let i = s.bar; i < s.bars; i++) {
    const x0 = padL + cw * (nPre + i) + cw * 0.12;
    const ww = cw * 0.76;
    ctx.fillStyle = C.slot;
    ctx.fillRect(x0, padT, ww, plotH);
    if (i === s.bar && s.status === 'play') {
      ctx.strokeStyle = C.next;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x0 + 0.5, padT + 0.5, ww - 1, plotH - 1);
      ctx.setLineDash([]);
    }
    if (s.revealed.includes(i)) {
      const m = shownMove(s, i);
      const cx = x0 + ww / 2;
      const cy = padT + plotH / 2;
      const sz = Math.min(ww * 0.36, 14);
      ctx.fillStyle = m > 0 ? C.up : m < 0 ? C.down : C.flat;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      if (m > 0) {
        ctx.moveTo(cx, cy - sz);
        ctx.lineTo(cx + sz, cy + sz * 0.7);
        ctx.lineTo(cx - sz, cy + sz * 0.7);
      } else if (m < 0) {
        ctx.moveTo(cx, cy + sz);
        ctx.lineTo(cx + sz, cy - sz * 0.7);
        ctx.lineTo(cx - sz, cy - sz * 0.7);
      } else {
        ctx.rect(cx - sz * 0.7, cy - sz * 0.3, sz * 1.4, sz * 0.6);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(m > 0 ? 'UP' : m < 0 ? 'DOWN' : 'FLAT', cx, cy + sz + 12);
      if (hiddenHeadline(s, i)) {
        ctx.fillStyle = C.amber;
        ctx.fillText('+ NEWS ?', cx, cy + sz + 24);
      }
    }
  }

  ctx.textAlign = 'center';
  ctx.font = '10px "JetBrains Mono", monospace';
  for (let i = 0; i < s.bars; i++) {
    const cx = xc(nPre + i);
    ctx.fillStyle = i === s.bar && s.status === 'play' ? C.next : C.gridText;
    ctx.fillText(String(i + 1), cx, h - padB / 2);
  }

  for (const n of s.news) {
    if (!isNewsVisible(s, n) || n.bar < s.bar - 0) {
      if (n.bar < s.bar) {
        const cx = xc(nPre + n.bar);
        ctx.fillStyle = 'rgba(255,200,87,0.35)';
        ctx.font = '600 9px "JetBrains Mono", monospace';
        ctx.fillText('N', cx, padT - 8);
      }
      continue;
    }
    const cx = xc(nPre + n.bar);
    const cy = padT - 12;
    ctx.fillStyle = n.swan ? C.down : C.amber;
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10161d';
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.fillText(n.swan ? '!!' : 'N', cx, cy + 0.5);
    if (n.known) {
      ctx.fillStyle = n.move > 0 ? C.up : C.down;
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillText(`${n.move > 0 ? '+' : '−'}${Math.abs(n.move)}`, cx, padT + 10);
    } else {
      ctx.fillStyle = C.amber;
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillText('±?', cx, padT + 10);
    }
  }

  const bw = Math.max(3, cw * 0.56);
  candles.forEach((k, i) => {
    const cx = xc(i);
    const isPre = i < nPre;
    const col = k.c > k.o ? C.up : k.c < k.o ? C.down : C.flat;
    ctx.globalAlpha = isPre ? 0.38 : 1;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, y(k.h));
    ctx.lineTo(cx, y(k.l));
    ctx.stroke();
    const top = y(Math.max(k.o, k.c));
    const bot = y(Math.min(k.o, k.c));
    ctx.fillStyle = col;
    ctx.fillRect(cx - bw / 2, top, bw, Math.max(1.5, bot - top));
    ctx.globalAlpha = 1;
  });

  if (pv && s.status === 'play') {
    const gx1 = padL + cw * (nPre + s.bar);
    const py0 = y(s.price);
    pv.ghosts.forEach((g, gi) => {
      const gx2 = Math.min(w - padR, padL + cw * (nPre + s.bar + g.bars));
      if (g.kind === 'straddle') {
        const need = 3 / Math.max(1, g.size);
        const yHi = y(s.price + need);
        const yLo = y(s.price - need);
        ctx.fillStyle = 'rgba(179,136,255,0.10)';
        ctx.fillRect(gx1, padT, gx2 - gx1, yHi - padT);
        ctx.fillRect(gx1, yLo, gx2 - gx1, h - padB - yLo);
        ctx.fillStyle = 'rgba(140,150,170,0.06)';
        ctx.fillRect(gx1, yHi, gx2 - gx1, yLo - yHi);
      } else if (gi === 0) {
        const good = g.dir > 0 ? 'rgba(46,229,157,0.09)' : 'rgba(255,92,122,0.08)';
        const bad = g.dir > 0 ? 'rgba(255,92,122,0.06)' : 'rgba(46,229,157,0.06)';
        ctx.fillStyle = g.dir > 0 ? good : bad;
        ctx.fillRect(gx1, padT, gx2 - gx1, py0 - padT);
        ctx.fillStyle = g.dir > 0 ? bad : good;
        ctx.fillRect(gx1, py0, gx2 - gx1, h - padB - py0);
        ctx.font = '700 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = C.up;
        ctx.fillText(g.dir > 0 ? `+${g.size} per point up` : `+${g.size} per point down`, gx1 + 6, g.dir > 0 ? padT + 12 : h - padB - 10);
        ctx.fillStyle = C.down;
        ctx.fillText(g.dir > 0 ? `−${g.size} per point down` : `−${g.size} per point up`, gx1 + 6, g.dir > 0 ? h - padB - 10 : padT + 12);
      }
      const col = g.kind === 'straddle' ? C.violet : g.dir > 0 ? C.up : C.down;
      const yy = Math.round(py0) + 0.5 + gi * 3;
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(gx1, yy);
      ctx.lineTo(gx2, yy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(gx2, yy - 6);
      ctx.lineTo(gx2, yy + 6);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
    for (const i of pv.reveal) {
      const x0 = padL + cw * (nPre + i) + cw * 0.12;
      const ww = cw * 0.76;
      ctx.strokeStyle = 'rgba(76,201,240,0.95)';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(76,201,240,0.8)';
      ctx.shadowBlur = 8;
      ctx.strokeRect(x0 + 1, padT + 1, ww - 2, plotH - 2);
      ctx.shadowBlur = 0;
      if (!s.revealed.includes(i)) {
        ctx.fillStyle = 'rgba(76,201,240,0.9)';
        ctx.font = '800 14px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('?', x0 + ww / 2, padT + plotH / 2);
      }
    }
    if (pv.nudge) {
      const cx = padL + cw * (nPre + s.bar + 0.5);
      const yA = y(s.price);
      const yB = y(s.price + pv.nudge);
      ctx.strokeStyle = C.amber;
      ctx.fillStyle = C.amber;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(cx, yA);
      ctx.lineTo(cx, yB);
      ctx.stroke();
      const dir = pv.nudge > 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(cx, yB);
      ctx.lineTo(cx - 6, yB - dir * 8);
      ctx.lineTo(cx + 6, yB - dir * 8);
      ctx.fill();
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${pv.nudge > 0 ? '+' : '−'}${Math.abs(pv.nudge)}`, cx + 8, yB);
    }
  }

  const stack: Record<string, number> = {};
  for (const t of s.trades) {
    const col = t.kind === 'straddle' ? C.violet : t.dir > 0 ? C.up : C.down;
    const hl = !!pv && pv.highlight.includes(t.id);
    const key = `${t.openedAt}:${t.entry}`;
    const slot = stack[key] ?? 0;
    stack[key] = slot + 1;
    const x1 = padL + cw * (nPre + t.openedAt);
    const x2 = Math.min(w - padR, padL + cw * (nPre + s.bar + t.barsLeft));
    const yy = Math.round(y(t.entry)) + 0.5;
    if (hl && pv && pv.extend) {
      const x3 = Math.min(w - padR, padL + cw * (nPre + s.bar + t.barsLeft + pv.extend));
      ctx.strokeStyle = C.amber;
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(x2, yy);
      ctx.lineTo(x3, yy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (hl) {
      ctx.shadowColor = col;
      ctx.shadowBlur = 10;
    }
    ctx.strokeStyle = col;
    ctx.lineWidth = hl ? 3 : 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, yy);
    ctx.lineTo(x2, yy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x2, yy - 5);
    ctx.lineTo(x2, yy + 5);
    ctx.stroke();
    const label = `${t.kind === 'straddle' ? 'X' : t.dir > 0 ? 'L' : 'S'}${t.size}`;
    ctx.font = '700 10px "JetBrains Mono", monospace';
    const tw = ctx.measureText(label).width + 8;
    const ly = Math.max(padT + 8, yy - slot * 17);
    if (slot > 0) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x1 - 2, yy);
      ctx.lineTo(x1 - 2, ly);
      ctx.stroke();
    }
    ctx.fillStyle = col;
    drawRound(ctx, x1 - tw - 2, ly - 8, tw, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#0b0f14';
    ctx.textAlign = 'center';
    ctx.fillText(label, x1 - tw / 2 - 2, ly + 0.5);
    ctx.shadowBlur = 0;
  }

  if (s.candles.length) {
    const i = nPre + s.candles.length - 1;
    const k = candles[i];
    const last = s.candles[s.candles.length - 1];
    const mv = last.c - last.o;
    const cx = xc(i);
    ctx.globalAlpha = Math.min(1, p * 1.5);
    ctx.font = '800 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = mv > 0 ? C.up : mv < 0 ? C.down : C.flat;
    const txt = mv > 0 ? `+${mv}` : mv < 0 ? `−${-mv}` : '0';
    if (mv >= 0) ctx.fillText(txt, cx, Math.max(padT + 8, y(k.h) - 10));
    else ctx.fillText(txt, cx, Math.min(h - padB - 6, y(k.l) + 12));
    ctx.globalAlpha = 1;
  }

  const py = Math.round(y(lastPrice)) + 0.5;
  ctx.strokeStyle = 'rgba(76,201,240,0.5)';
  ctx.setLineDash([2, 3]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, py);
  ctx.lineTo(w - padR, py);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = C.price;
  drawRound(ctx, w - padR + 2, py - 10, padR - 6, 20, 4);
  ctx.fill();
  ctx.fillStyle = '#071018';
  ctx.font = '800 12px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(s.base + lastPrice)), w - padR + 2 + (padR - 6) / 2, py + 0.5);
}

export function Chart({ s, version, preview }: { s: SessionState; version: number; preview?: Preview | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const anim = useRef({ count: s.candles.length, start: 0 });
  const [size, setSize] = useState({ w: 640, h: 320 });

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(240, Math.floor(r.width)), h: Math.max(180, Math.floor(r.height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    if (s.candles.length > anim.current.count) anim.current.start = performance.now();
    else if (s.candles.length < anim.current.count) anim.current.start = 0;
    anim.current.count = s.candles.length;
    const dpr = window.devicePixelRatio || 1;
    cv.width = size.w * dpr;
    cv.height = size.h * dpr;
    cv.style.width = `${size.w}px`;
    cv.style.height = `${size.h}px`;
    let raf = 0;
    const frame = () => {
      const p = Math.min(1, (performance.now() - anim.current.start) / 480);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      render(ctx, s, size.w, size.h, p, preview ?? null);
      if (p < 1) raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [version, size, s, preview]);

  return (
    <div class="chart-wrap" ref={wrap}>
      <canvas ref={canvas} aria-label="Price chart" />
    </div>
  );
}
