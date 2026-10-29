/**
 * Saved data in localStorage, under keys prefixed "qc.". Every record is
 * versioned so a format change can be detected and reset cleanly. Storage
 * may be unavailable (private mode): everything falls back to defaults.
 */
import type { Difficulty } from '../game/types';

export interface Settings {
  difficulty: Difficulty;
  /** Fill the screen (bigger) or keep whole-number scaling (sharper). */
  sharpScreen: boolean;
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
  difficulty: 'normal',
  sharpScreen: false,
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
  /** Missing on entries saved before difficulty existed: those were played at what is now Easy. */
  difficulty?: Difficulty;
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
  const s = { ...DEFAULT_SETTINGS, ...(read<Partial<Settings>>(KEYS.settings) ?? {}) };
  if (!['easy', 'normal', 'hard'].includes(s.difficulty)) s.difficulty = 'normal';
  return s;
}
export function saveSettings(s: Settings): void {
  write(KEYS.settings, s);
}

/**
 * The table a new machine starts with. AAM holds the top spot; the rest is
 * mostly for a Liverpool fan, plus a couple of arcade classics: KOP and END sit together so they read "KOP END",
 * and MER / SEY spell MERSEY. LFC's score is a nod to the club's founding
 * year (1892).
 */
export const DEFAULT_TABLE: [string, number][] = [
  ['AAM', 20000],
  ['LFC', 18920],
  ['KOP', 16000],
  ['END', 14000],
  ['ACE', 12000],
  ['AAA', 10000],
  ['RED', 8000],
  ['LIV', 6000],
  ['MER', 4000],
  ['SEY', 2000],
];

export function defaultScores(): ScoreEntry[] {
  return DEFAULT_TABLE.map(([initials, score], i) => ({ initials, score, level: Math.max(0, 3 - Math.floor(i / 3)), difficulty: 'normal' as Difficulty }));
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
