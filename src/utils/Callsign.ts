const SURNAMES = [
  'Reyes', 'Vega', 'Stark', 'Marek', 'Solis', 'Kade', 'Voss', 'Halvor',
  'Okafor', 'Tarn', 'Jin', 'Mori', 'Ash', 'Drell', 'Kestrel', 'Quill',
  'Riven', 'Cassel', 'Holt', 'Vanya', 'Idris', 'Calder', 'Brann', 'Sten',
  'Nyx', 'Onyx', 'Fawkes', 'Greer', 'Hadid', 'Sable', 'Korr', 'Vexa',
  'Tovar', 'Mireya', 'Zane', 'Rook', 'Echo', 'Sieg', 'Lior', 'Pax',
];

const SUFFIXES = [
  '01', '02', '03', '04', '05', '06', '07', '09', '11', '13',
  '17', '21', '23', '27', '31', '37', '41', '47',
  'A', 'B', 'C', 'D', 'X', 'Z',
];

const used = new Set<string>();

/**
 * Generate a unique-ish callsign in the format "Surname-Suffix".
 * Tracks names in-process to reduce collisions across one session;
 * persistence is the responsibility of the caller.
 */
export function generateCallsign(): string {
  for (let attempt = 0; attempt < 12; attempt++) {
    const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
    const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
    const callsign = `${surname}-${suffix}`;
    if (!used.has(callsign)) {
      used.add(callsign);
      return callsign;
    }
  }
  // Fallback — append a timestamp slice if the pool is exhausted.
  const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
  return `${surname}-${Date.now().toString(36).slice(-3).toUpperCase()}`;
}

/**
 * Seed the used-name set from existing roster on hydrate so we don't
 * regenerate names that already exist.
 */
export function reserveCallsigns(callsigns: Iterable<string>): void {
  for (const c of callsigns) used.add(c);
}
