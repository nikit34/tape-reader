const PATHS: Record<string, string> = {
  up: 'M3 17l6-6 4 4 8-8 M15 7h6v6',
  down: 'M3 7l6 6 4-4 8 8 M15 17h6v-6',
  upfast: 'M6 14l6-6 6 6 M6 20l6-6 6 6',
  downfast: 'M6 4l6 6 6-6 M6 10l6 6 6-6',
  uplong: 'M12 21V4 M6 10l6-6 6 6 M4 21h16',
  downlong: 'M12 3v17 M6 14l6 6 6-6 M4 3h16',
  rocket: 'M12 2c3.5 3 4.5 7.5 3 12l-3 3-3-3C7.5 9.5 8.5 5 12 2z M9 15l-3 5 4-1 M15 15l3 5-4-1 M12 8.5v.5',
  skull: 'M12 3a7 7 0 0 0-7 7c0 2.6 1.3 4.3 3 5.3V19h8v-3.7c1.7-1 3-2.7 3-5.3a7 7 0 0 0-7-7z M9 10h.01 M15 10h.01 M10 19v2 M14 19v2',
  wave: 'M2 14c2.5-6 5-6 7.5 0s5 6 7.5 0 3.5-4 5-4 M18 6h4v4',
  fade: 'M3 16l5-9 5 9 M13 16h8 M17 12l4 4-4 4',
  straddle: 'M3 12h5 M8 12l12-8 M8 12l12 8 M16 4h4v4 M16 20h4v-4',
  arb: 'M4 8h14 M14 4l4 4-4 4 M20 16H6 M10 12l-4 4 4 4',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  chart: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  replay: 'M4 12a8 8 0 1 0 2.4-5.7 M4 4v5h5',
  whisper: 'M4 5h16v10H9l-5 4V5z M9 10h.01 M12 10h.01 M15 10h.01',
  doc: 'M6 2h9l5 5v15H6z M14 2v6h6 M9 13h8 M9 17h6',
  cup: 'M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z M16 11h2a2 2 0 0 1 0 4h-2 M8 2v3 M12 2v3',
  coins: 'M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3z M4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7 M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5',
  scissors: 'M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M8.5 7.5L20 18 M8.5 16.5L20 6',
  lock: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4 M12 15v2',
  cycle: 'M20 11A8 8 0 0 0 5.6 6.3L4 8 M4 4v4h4 M4 13a8 8 0 0 0 14.4 4.7L20 16 M20 20v-4h-4',
  double: 'M8 8h12v12H8z M4 16V4h12',
  pyramid: 'M12 3l9 17H3z M7.5 14h9 M9.7 9.5h4.6',
  shield: 'M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5z',
  flip: 'M7 4v16 M3 8l4-4 4 4 M17 20V4 M13 16l4 4 4-4',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  pump: 'M12 21V7 M6 12l6-6 6 6 M8 3h8',
  dump: 'M12 3v14 M6 12l6 6 6-6 M8 21h8',
  handshake: 'M3 7h18v13H3z M8 7V4h8v3 M3 13h18',
  book: 'M3 5h8 M3 9h6 M3 13h9 M3 17h5 M13 7h8 M15 11h6 M14 15h7 M16 19h5',
  arrowstack: 'M5 12l7-7 7 7 M5 18l7-7 7 7',
  spiral: 'M12 12a1.5 1.5 0 1 1 1.5-1.5 M13.5 10.5A4 4 0 1 1 9 15 M9 15a6.5 6.5 0 1 1 11-3',
  brain: 'M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V5a3 3 0 0 0-3-1z M15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1',
  anchor: 'M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M12 8v13 M5 13a7 7 0 0 0 14 0 M8 11h8',
  heart: 'M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z',
  flame: 'M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-5 1-9z',
  deck: 'M5 6h11v15H5z M8 3h11v15',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M4.9 19.1L7 17 M17 7l2.1-2.1',
  sound: 'M4 9h4l5-4v14l-5-4H4z M16 9a4 4 0 0 1 0 6 M19 6a8 8 0 0 1 0 12',
  mute: 'M4 9h4l5-4v14l-5-4H4z M17 9l5 6 M22 9l-5 6',
  music: 'M9 18V5l11-2v13 M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7v.5 M12 17h.01',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4z M10 20a2 2 0 0 0 4 0',
  news: 'M4 5h13v14H6a2 2 0 0 1-2-2z M17 9h3v8a2 2 0 0 1-2 2 M7 9h7 M7 13h7 M7 16h4',
  close: 'M6 6l12 12 M18 6L6 18',
  play: 'M7 4l13 8-13 8z',
};

export function Icon({ name, size = 24, stroke = 2 }: { name: string; size?: number; stroke?: number }) {
  const d = PATHS[name] ?? 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z';
  return (
    <svg
      class="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={stroke}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
