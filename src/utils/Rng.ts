/**
 * Small deterministic PRNG (mulberry32). A fixed seed yields a fixed sequence,
 * which makes generated levels reproducible and unit-testable.
 */
export class Rng {
  private state: number;

  constructor(seed = Date.now() >>> 0) {
    this.state = seed >>> 0;
  }

  /** Float in [0, 1). */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Pick a random element. */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** In-place Fisher-Yates shuffle (returns the same array). */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
