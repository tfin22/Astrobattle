/**
 * Seeded pseudo-random generator (mulberry32). Small, fast and identical on
 * every JavaScript engine because it only uses 32-bit integer maths.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** Raw 32-bit state, for snapshots and replay checks. */
  get state(): number {
    return this.s;
  }

  nextU32(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** Float in [0, 1). */
  next(): number {
    return this.nextU32() / 4294967296;
  }

  /** Integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** Float in [a, b). */
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }

  sign(): number {
    return this.next() < 0.5 ? -1 : 1;
  }

  /** A new independent stream derived from this seed and a salt. */
  static derive(seed: number, salt: number): Rng {
    let h = (seed ^ Math.imul(salt + 0x9e3779b9, 0x85ebca6b)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
    return new Rng((h ^ (h >>> 16)) >>> 0);
  }
}
