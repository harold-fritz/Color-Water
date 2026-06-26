import type { Bottle } from '../models/Bottle';
import type { GameState } from '../models/GameState';
import type { ColorId } from '../models/Color';

export interface PourPlan {
  readonly color: ColorId;
  readonly count: number;
}

export type PourRejection =
  | 'same-bottle'
  | 'source-empty'
  | 'source-large' // large bottles cannot be moved (cannot be a source)
  | 'source-capped'
  | 'dest-capped'
  | 'dest-full'
  | 'color-mismatch';

export type PourResult =
  | { ok: true; plan: PourPlan }
  | { ok: false; reason: PourRejection };

/**
 * Stateless rules describing when and how liquid may be poured. The whole
 * water-sort behaviour is captured here so it can be unit tested in isolation.
 */
export const GameRules = {
  /**
   * Compute whether `from -> to` is legal and, if so, how much pours.
   *
   * Water-sort semantics: the maximal run of identical top color moves at
   * once, limited by the destination's free space. The destination must be
   * empty or share the same top color.
   */
  evaluatePour(from: Bottle, to: Bottle): PourResult {
    if (from.id === to.id) return { ok: false, reason: 'same-bottle' };
    if (from.isEmpty) return { ok: false, reason: 'source-empty' };
    if (from.isLarge) return { ok: false, reason: 'source-large' };
    if (from.capped) return { ok: false, reason: 'source-capped' };
    if (to.capped) return { ok: false, reason: 'dest-capped' };
    if (to.isFull) return { ok: false, reason: 'dest-full' };

    const color = from.topColor as ColorId;
    if (!to.isEmpty && to.topColor !== color) {
      return { ok: false, reason: 'color-mismatch' };
    }

    const count = Math.min(from.topRunLength, to.freeSpace);
    return { ok: true, plan: { color, count } };
  },

  canPour(from: Bottle, to: Bottle): boolean {
    return this.evaluatePour(from, to).ok;
  },

  /** True when at least one legal move exists anywhere on the board. */
  hasAnyMove(state: GameState): boolean {
    const bottles = state.bottles;
    for (const from of bottles) {
      for (const to of bottles) {
        if (this.canPour(from, to)) return true;
      }
    }
    return false;
  },

  /** A bottle should be capped the moment it is full and a single color. */
  shouldCap(bottle: Bottle): boolean {
    return !bottle.capped && bottle.isComplete;
  },
};
