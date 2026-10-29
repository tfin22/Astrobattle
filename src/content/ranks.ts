/**
 * The rank ladder. Each full loop of five missions promotes you one rank.
 * `say` is how VORG pronounces the short rank name (phonemes, see
 * content/speech.ts). Difficulty numbers per rank live in tuning.ts.
 */
export interface Rank {
  name: string;
  short: string;
  say: string;
}

export const RANKS: Rank[] = [
  { name: 'QUANTUM CADET', short: 'CADET', say: 'K AH D EH1 T' },
  { name: 'QUANTUM ENSIGN', short: 'ENSIGN', say: 'EH1 N S AY N' },
  { name: 'QUANTUM LIEUTENANT', short: 'LIEUTENANT', say: 'L UW T EH1 N AH N T' },
  { name: 'QUANTUM COMMANDER', short: 'COMMANDER', say: 'K AH M AE1 N D ER' },
  { name: 'QUANTUM COMMODORE', short: 'COMMODORE', say: 'K AA1 M AH D AO R' },
  { name: 'QUANTUM ADMIRAL', short: 'ADMIRAL', say: 'AE1 D M ER AH L' },
];

export const MAX_RANK = RANKS.length - 1;

/** Rank index for a level (levels beyond Admiral stay Admiral). */
export function rankIndex(level: number): number {
  return Math.min(level, MAX_RANK);
}

/** "ADMIRAL", then "ADMIRAL *2" (shown as a multiply sign) and so on. */
export function rankLabel(level: number, short = false): string {
  const r = RANKS[rankIndex(level)];
  const name = short ? r.short : r.name;
  const times = level - MAX_RANK + 1;
  return level > MAX_RANK ? `${name} *${times}` : name;
}
