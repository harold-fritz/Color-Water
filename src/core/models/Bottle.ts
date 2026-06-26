import type { ColorId } from './Color';

export interface BottleSnapshot {
  readonly id: number;
  readonly capacity: number;
  readonly isLarge: boolean;
  /** Colors from bottom (index 0) to top (last index). */
  readonly segments: ColorId[];
  readonly capped: boolean;
}

/**
 * A bottle holds a vertical stack of colored liquid segments.
 *
 * Index 0 is the bottom of the bottle, the last index is the top (the only
 * place liquid can be poured from / into). Large bottles cannot be used as a
 * pour *source* (they "cannot be moved"); they can only receive liquid.
 */
export class Bottle {
  readonly id: number;
  readonly capacity: number;
  readonly isLarge: boolean;

  private _segments: ColorId[];
  private _capped: boolean;

  constructor(id: number, capacity: number, isLarge = false, segments: ColorId[] = []) {
    if (capacity <= 0) throw new Error(`Bottle ${id}: capacity must be > 0`);
    if (segments.length > capacity) {
      throw new Error(`Bottle ${id}: initial segments exceed capacity`);
    }
    this.id = id;
    this.capacity = capacity;
    this.isLarge = isLarge;
    this._segments = [...segments];
    this._capped = false;
  }

  /** Colors from bottom to top. A defensive copy. */
  get segments(): ColorId[] {
    return [...this._segments];
  }

  get size(): number {
    return this._segments.length;
  }

  get freeSpace(): number {
    return this.capacity - this._segments.length;
  }

  get isEmpty(): boolean {
    return this._segments.length === 0;
  }

  get isFull(): boolean {
    return this._segments.length === this.capacity;
  }

  get capped(): boolean {
    return this._capped;
  }

  /** The top color, or undefined when empty. */
  get topColor(): ColorId | undefined {
    return this._segments[this._segments.length - 1];
  }

  /** Number of identical colors contiguously at the top. */
  get topRunLength(): number {
    if (this.isEmpty) return 0;
    const top = this.topColor;
    let n = 0;
    for (let i = this._segments.length - 1; i >= 0; i--) {
      if (this._segments[i] === top) n++;
      else break;
    }
    return n;
  }

  /** A bottle is monochrome when all of its segments share one color. */
  get isMonochrome(): boolean {
    if (this.isEmpty) return false;
    return this._segments.every((c) => c === this._segments[0]);
  }

  /** A bottle is "complete" when it is full and a single color. */
  get isComplete(): boolean {
    return this.isFull && this.isMonochrome;
  }

  /** Pop `count` colors off the top and return them (top-most first). */
  removeTop(count: number): ColorId[] {
    if (count <= 0) return [];
    if (count > this._segments.length) {
      throw new Error(`Bottle ${this.id}: cannot remove ${count} of ${this._segments.length}`);
    }
    const removed: ColorId[] = [];
    for (let i = 0; i < count; i++) {
      removed.push(this._segments.pop() as ColorId);
    }
    return removed; // top-most first
  }

  /** Push `count` copies of `color` onto the top. */
  addTop(color: ColorId, count: number): void {
    if (count <= 0) return;
    if (count > this.freeSpace) {
      throw new Error(`Bottle ${this.id}: overflow adding ${count} (free ${this.freeSpace})`);
    }
    for (let i = 0; i < count; i++) this._segments.push(color);
  }

  /** Mark this bottle as sealed (capped) so it can no longer be used. */
  cap(): void {
    this._capped = true;
  }

  /** Remove the cap (used when undoing the move that sealed the bottle). */
  uncap(): void {
    this._capped = false;
  }

  snapshot(): BottleSnapshot {
    return {
      id: this.id,
      capacity: this.capacity,
      isLarge: this.isLarge,
      segments: [...this._segments],
      capped: this._capped,
    };
  }

  clone(): Bottle {
    const b = new Bottle(this.id, this.capacity, this.isLarge, this._segments);
    if (this._capped) b.cap();
    return b;
  }

  static fromSnapshot(s: BottleSnapshot): Bottle {
    const b = new Bottle(s.id, s.capacity, s.isLarge, s.segments);
    if (s.capped) b.cap();
    return b;
  }
}
