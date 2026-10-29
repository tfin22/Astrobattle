/**
 * Deterministic trig for the simulation. Math.sin and friends may differ in
 * the last bits between browsers, which would break replays, so game logic
 * uses these table-based versions built with plain arithmetic only.
 */
const N = 4096;
const TWO_PI = 6.283185307179586;
const SIN = new Float64Array(N + 1);

function taylorSin(x: number): number {
  // x in [-pi, pi]; 11 terms is far more than enough for a lookup table.
  let term = x;
  let sum = x;
  const x2 = x * x;
  for (let i = 1; i < 12; i++) {
    term = (-term * x2) / ((2 * i) * (2 * i + 1));
    sum += term;
  }
  return sum;
}

for (let i = 0; i <= N; i++) {
  let a = (i / N) * TWO_PI;
  if (a > Math.PI) a -= TWO_PI;
  SIN[i] = taylorSin(a);
}

export const PI = 3.141592653589793;
export const TAU = TWO_PI;

export function fsin(a: number): number {
  let t = (a / TWO_PI) % 1;
  if (t < 0) t += 1;
  const f = t * N;
  const i = Math.floor(f);
  const r = f - i;
  return SIN[i] + (SIN[i + 1] - SIN[i]) * r;
}

export function fcos(a: number): number {
  return fsin(a + PI / 2);
}

/** atan2 using a polynomial approximation (max error ~0.0001 rad). */
export function fatan2(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const swap = ay > ax;
  const z = swap ? ax / ay : ay / ax;
  const z2 = z * z;
  let r = z * (0.9998660 + z2 * (-0.3302995 + z2 * (0.1801410 + z2 * (-0.0851330 + z2 * 0.0208351))));
  if (swap) r = PI / 2 - r;
  if (x < 0) r = PI - r;
  if (y < 0) r = -r;
  return r;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function sign(v: number): number {
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
