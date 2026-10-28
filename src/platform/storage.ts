/**
 * Saved data in localStorage, under keys prefixed "qc.". Every record is
 * versioned so a format change can be detected and reset cleanly. Storage
 * may be unavailable (private mode): everything falls back to defaults.
 */
export interface Settings {
  startShips: number;     // 3..5
  holdToFire: boolean;
  dpad: boolean;
  sound: boolean;
  volume: number;         // 0..1
  subtitles: boolean;
  crt: boolean;
  bezel: boolean;
  haptics: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  startShips: 3,
  holdToFire: false,
  dpad: false,
  sound: true,
  volume: 0.8,
  subtitles: true,
  crt: false,
  bezel: false,
  haptics: true,
};

export interface ScoreEntry {
  initials: string;
  score: number;
  level: number;
}

export interface Progress {
  /** Highest level (rank) reached; unlocks practice ranks. */
  bestLevel: number;
}

const KEYS = { settings: 'qc.settings', scores: 'qc.scores', progress: 'qc.progress' };
const VERSION = 1;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw) as { v: number; data: T };
    if (obj.v !== VERSION) return null;
    return obj.data;
  } catch {
    return null;
  }
}

function write<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ v: VERSION, data }));
  } catch {
    /* storage full or blocked: play on without saving */
  }
}

export function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...(read<Partial<Settings>>(KEYS.settings) ?? {}) };
}
export function saveSettings(s: Settings): void {
  write(KEYS.settings, s);
}

/** A default table so the attract screen has something to show. */
export function defaultScores(): ScoreEntry[] {
  const names = ['VRG', 'BOT', 'ZAP', 'QBT', 'NUL', 'K9X', 'ARC', 'RAM', 'BIT', 'CPU'];
  return names.map((initials, i) => ({ initials, score: 20000 - i * 2000, level: Math.max(0, 3 - Math.floor(i / 3)) }));
}

export function loadScores(): ScoreEntry[] {
  const s = read<ScoreEntry[]>(KEYS.scores);
  return s && Array.isArray(s) ? s.slice(0, 10) : defaultScores();
}
export function saveScores(s: ScoreEntry[]): void {
  write(KEYS.scores, s.slice(0, 10));
}

export function loadProgress(): Progress {
  return { bestLevel: 0, ...(read<Progress>(KEYS.progress) ?? {}) };
}
export function saveProgress(p: Progress): void {
  write(KEYS.progress, p);
}

export function resetAll(): void {
  try {
    for (const k of Object.values(KEYS)) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/** Where a score would land in the table (0..9), or -1 if it doesn't make it. */
export function scoreRank(table: ScoreEntry[], score: number): number {
  if (score <= 0) return -1;
  for (let i = 0; i < 10; i++) {
    if (i >= table.length || score > table[i].score) return i;
  }
  return -1;
}

/** Insert a score; returns the new table (top 10). */
export function insertScore(table: ScoreEntry[], entry: ScoreEntry): ScoreEntry[] {
  const i = scoreRank(table, entry.score);
  if (i < 0) return table.slice(0, 10);
  const out = [...table];
  out.splice(i, 0, entry);
  return out.slice(0, 10);
}
