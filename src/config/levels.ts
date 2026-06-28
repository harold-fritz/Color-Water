import { COLOR_IDS } from '../core/models/Color';

/** Static description of a level's shape, before any colors are placed. */
export interface LevelConfig {
  readonly level: number;
  readonly largeBottles: number;
  readonly smallBottles: number;
  /** How many of the small bottles start empty (working space). */
  readonly emptySmallBottles: number;
  readonly smallCapacity: number;
  readonly largeCapacity: number;
  /** Number of reverse-scramble steps; higher = harder. */
  readonly scrambleMoves: number;
}

/**
 * Difficulty curve. Level 1 is the spec baseline: 2 large (immovable) bottles
 * and 6 small ones. Subsequent levels add colors, remove working space and
 * scramble harder.
 *
 * Invariant required by the generator:
 *   distinctColors = largeBottles + (smallBottles - emptySmallBottles)
 * and there must be at least one empty small bottle to pour into.
 */
export const LEVELS: LevelConfig[] = [
  { level: 1, largeBottles: 2, smallBottles: 6, emptySmallBottles: 2, smallCapacity: 4, largeCapacity: 8, scrambleMoves: 14 },
  { level: 2, largeBottles: 2, smallBottles: 7, emptySmallBottles: 2, smallCapacity: 4, largeCapacity: 8, scrambleMoves: 22 },
  { level: 3, largeBottles: 2, smallBottles: 8, emptySmallBottles: 2, smallCapacity: 4, largeCapacity: 8, scrambleMoves: 30 },
  { level: 4, largeBottles: 2, smallBottles: 9, emptySmallBottles: 2, smallCapacity: 5, largeCapacity: 10, scrambleMoves: 40 },
  { level: 5, largeBottles: 3, smallBottles: 10, emptySmallBottles: 2, smallCapacity: 5, largeCapacity: 10, scrambleMoves: 52 },
];

export const MAX_DEFINED_LEVEL = LEVELS.length;

/**
 * Returns the config for a level. Levels beyond the hand-tuned curve are
 * extrapolated procedurally so the game can continue endlessly.
 *
 * The number of distinct colors is bounded by the palette, so once the board
 * reaches that ceiling we stop adding bottles and keep raising the difficulty
 * through deeper scrambling instead. (Without this cap, level 7 onwards asked
 * for more colors than exist and the generator threw, stranding the player.)
 */
export function getLevelConfig(level: number): LevelConfig {
  if (level >= 1 && level <= LEVELS.length) {
    return LEVELS[level - 1];
  }
  const extra = level - LEVELS.length;
  const base = LEVELS[LEVELS.length - 1];
  const emptySmallBottles = 2;
  const largeBottles = base.largeBottles;

  // distinctColors = largeBottles + filledSmall must not exceed the palette.
  const maxFilledSmall = COLOR_IDS.length - largeBottles;
  const filledSmall = Math.min(base.smallBottles - base.emptySmallBottles + extra, maxFilledSmall);
  const smallBottles = filledSmall + emptySmallBottles;

  return {
    level,
    largeBottles,
    smallBottles,
    emptySmallBottles,
    smallCapacity: base.smallCapacity,
    largeCapacity: base.largeCapacity,
    // Keep ramping difficulty, but cap so very high levels stay quick to build.
    scrambleMoves: Math.min(base.scrambleMoves + extra * 10, 400),
  };
}
