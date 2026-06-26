import { Bottle, type BottleSnapshot } from './Bottle';

export interface GameStateSnapshot {
  readonly bottles: BottleSnapshot[];
}

/**
 * The full board: an ordered collection of bottles. Pure data + lookups; it
 * does not enforce any pour rules (that is the job of GameRules / GameEngine).
 */
export class GameState {
  readonly bottles: Bottle[];

  constructor(bottles: Bottle[]) {
    this.bottles = bottles;
  }

  bottle(id: number): Bottle {
    const b = this.bottles.find((x) => x.id === id);
    if (!b) throw new Error(`No bottle with id ${id}`);
    return b;
  }

  /** Every non-empty bottle is complete (full + monochrome) => solved. */
  get isSolved(): boolean {
    return this.bottles.every((b) => b.isEmpty || b.isComplete);
  }

  /** All bottles holding liquid are capped => the game is over. */
  get allCapped(): boolean {
    return this.bottles.every((b) => b.isEmpty || b.capped);
  }

  /** A compact, order-independent-per-bottle string for memoization/equality. */
  hash(): string {
    return this.bottles
      .map((b) => `${b.id}:${b.segments.join(',')}${b.capped ? '#' : ''}`)
      .join('|');
  }

  snapshot(): GameStateSnapshot {
    return { bottles: this.bottles.map((b) => b.snapshot()) };
  }

  clone(): GameState {
    return new GameState(this.bottles.map((b) => b.clone()));
  }

  static fromSnapshot(s: GameStateSnapshot): GameState {
    return new GameState(s.bottles.map((b) => Bottle.fromSnapshot(b)));
  }
}
