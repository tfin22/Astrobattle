import { melody, type SfxDef } from '../audio/chip';
import type { SfxId } from '../game/types';

/**
 * Every sound effect, as a program for the QC-1 chip (audio/chip.ts).
 * Ticks are 1/60 s; volumes 0..15; channel 'n' is noise (f = clock rate).
 */
export const SFX: Record<SfxId, SfxDef> = {
  // The quantum shot: a bright falling zap.
  shot: { voices: [
    { ch: 0, len: 7, f0: 2200, f1: 420, v0: 12, v1: 5 },
    { ch: 'n', len: 2, f0: 12000, v0: 4, v1: 0 },
  ] },
  // A new shot replaced the old one: a tiny high blip.
  cancel: { voices: [{ ch: 1, len: 3, f0: 3100, f1: 2400, v0: 10, v1: 3 }] },
  enemyShot: { voices: [{ ch: 2, len: 9, f0: 700, f1: 260, v0: 7, v1: 2 }] },
  dart: { voices: [{ ch: 2, len: 5, f0: 1800, f1: 1100, v0: 6, v1: 1, duty: 0.25 }] },
  explodeSmall: { voices: [
    { ch: 'n', len: 16, f0: 9000, f1: 1400, v0: 13, v1: 0 },
    { ch: 0, len: 8, f0: 260, f1: 70, v0: 8, v1: 0 },
  ] },
  explodeLarge: { vibrato: { rate: 9, depth: 0.15 }, voices: [
    { ch: 'n', len: 44, f0: 7000, f1: 350, v0: 15, v1: 0 },
    { ch: 0, len: 30, f0: 160, f1: 40, v0: 11, v1: 0 },
    { ch: 1, len: 20, f0: 240, f1: 60, v0: 7, v1: 0, duty: 0.3 },
  ] },
  // The force field fizzing as it's eaten.
  fizz: { voices: [
    { ch: 'n', len: 5, f0: 15000, f1: 9000, v0: 7, v1: 0 },
    { ch: 1, len: 3, f0: 3400, f1: 2600, v0: 4, v1: 0, duty: 0.2 },
  ] },
  chip: { voices: [
    { ch: 0, len: 4, f0: 1100, f1: 500, v0: 9, v1: 2 },
    { ch: 'n', len: 3, f0: 8000, v0: 6, v1: 0 },
  ] },
  clink: { voices: [
    { ch: 1, len: 3, f0: 3600, v0: 8, v1: 2 },
    { ch: 2, len: 3, f0: 4800, v0: 5, v1: 0 },
  ] },
  // Default length; the engine re-renders it to match each laser's charge time.
  laserCharge: { vibrato: { rate: 14, depth: 0.05 }, voices: [
    { ch: 0, len: 80, f0: 180, f1: 1500, v0: 5, v1: 12 },
    { ch: 1, len: 80, f0: 360, f1: 3000, v0: 2, v1: 6, duty: 0.25 },
  ] },
  laserFire: { vibrato: { rate: 30, depth: 0.2 }, voices: [
    { ch: 0, len: 40, f0: 95, f1: 80, v0: 13, v1: 4 },
    { ch: 1, len: 40, f0: 142, f1: 120, v0: 9, v1: 2, duty: 0.2 },
    { ch: 'n', len: 40, f0: 4000, f1: 2500, v0: 9, v1: 2 },
  ] },
  warpOut: { voices: [{ ch: 1, len: 14, f0: 260, f1: 1300, v0: 7, v1: 2, duty: 0.3 }] },
  // Siren: two notes alternating.
  flagAlarm: { voices: [{ ch: 0, len: 96, f0: 720, v0: 10, v1: 6, arp: [0, 5], arpRate: 12 }] },
  // The flagship's long, falling explosion.
  flagBoom: { vibrato: { rate: 6, depth: 0.25 }, voices: [
    { ch: 'n', len: 250, f0: 9000, f1: 160, v0: 15, v1: 0 },
    { ch: 0, len: 220, f0: 420, f1: 28, v0: 13, v1: 0 },
    { ch: 1, len: 200, f0: 300, f1: 22, v0: 9, v1: 0, duty: 0.3 },
    { ch: 2, at: 20, len: 160, f0: 600, f1: 40, v0: 7, v1: 0, duty: 0.15 },
  ] },
  death: { vibrato: { rate: 18, depth: 0.12 }, voices: [
    { ch: 0, len: 60, f0: 1300, f1: 70, v0: 13, v1: 0 },
    { ch: 'n', len: 50, f0: 5000, f1: 300, v0: 12, v1: 0 },
  ] },
  extraLife: { voices: [
    ...melody(1, ['C6', 'E6', 'G6', 'C7', 'E6', 'G6', 'C7', 'E7'], 4, 11, 0, 4),
  ] },
  // Mission complete: a short original fanfare in three voices.
  fanfare: { voices: [
    ...melody(0, ['G5', 'G5', 'C6', '-', 'E6', 'D6', 'C6', 'G6'], 7, 12, 0, 5),
    ...melody(1, ['E5', 'E5', 'G5', '-', 'C6', 'B5', 'G5', 'E6'], 7, 8, 0, 4),
    { ch: 2, at: 49, len: 30, f0: 196, v0: 9, v1: 0 },
    { ch: 0, at: 56, len: 28, f0: 1568, v0: 12, v1: 0 },
  ] },
  coin: { voices: [
    { ch: 1, len: 4, f0: 988, v0: 12, v1: 10 },
    { ch: 1, at: 4, len: 16, f0: 1319, v0: 12, v1: 0 },
  ] },
  saucer: { vibrato: { rate: 7, depth: 0.22 }, voices: [{ ch: 2, len: 110, f0: 520, v0: 6, v1: 3, duty: 0.35 }] },
  saucerHit: { voices: [
    { ch: 0, len: 30, f0: 1600, f1: 200, v0: 12, v1: 0, arp: [0, 7, 12], arpRate: 2 },
    { ch: 'n', len: 20, f0: 6000, f1: 800, v0: 10, v1: 0 },
  ] },
  hitCarrier: { voices: [
    { ch: 0, len: 4, f0: 520, f1: 380, v0: 11, v1: 4 },
    { ch: 'n', len: 3, f0: 6000, v0: 7, v1: 0 },
  ] },
  promote: { voices: [
    ...melody(0, ['C5', 'E5', 'G5', 'C6', 'E6', 'G6'], 6, 12, 0, 3),
    { ch: 0, at: 36, len: 40, f0: 2093, v0: 12, v1: 0 },
    { ch: 1, at: 36, len: 40, f0: 1568, v0: 9, v1: 0 },
    { ch: 2, at: 36, len: 40, f0: 1319, v0: 8, v1: 0 },
  ] },
  tick: { voices: [{ ch: 1, len: 2, f0: 1700, v0: 7, v1: 2 }] },
  start: { voices: [
    { ch: 0, len: 8, f0: 300, f1: 1200, v0: 9, v1: 4 },
    { ch: 1, at: 4, len: 8, f0: 450, f1: 1800, v0: 6, v1: 2 },
  ] },
};

/** The background pulse: two low thumps, alternating. */
export const PULSE: SfxDef[] = [
  { voices: [{ ch: 0, len: 6, f0: 78, f1: 62, v0: 11, v1: 0 }] },
  { voices: [{ ch: 0, len: 6, f0: 66, f1: 52, v0: 11, v1: 0 }] },
];

/** Looping beds. */
export const LOOPS = {
  // Space Warp's rising drone: climbs and resets, forever.
  warp: { vibrato: { rate: 5, depth: 0.04 }, voices: [
    { ch: 0, len: 120, f0: 70, f1: 280, v0: 6, v1: 8 },
    { ch: 1, len: 120, f0: 105, f1: 420, v0: 3, v1: 5, duty: 0.25 },
  ] } as SfxDef,
};
