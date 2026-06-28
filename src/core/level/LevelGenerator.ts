import { Bottle } from '../models/Bottle';
import { GameState } from '../models/GameState';
import type { Move } from '../models/Move';
import type { ColorId } from '../models/Color';
import { COLOR_IDS } from '../models/Color';
import { GameRules } from '../rules/GameRules';
import { Rng } from '../../utils/Rng';
import type { LevelConfig } from '../../config/levels';

export interface GeneratedLevel {
  readonly config: LevelConfig;
  readonly state: GameState;
  /** A sequence of legal forward moves that provably solves the level. */
  readonly solution: Move[];
  /** Target move count (the length of the generated solution). */
  readonly par: number;
}

/**
 * Builds solvable levels via *reverse scrambling*.
 *
 * We start from the fully-solved board (every bottle complete or empty) and
 * repeatedly apply "inverse pours": take some of a bottle D's top run and place
 * it on a non-large bottle S. Each inverse pour corresponds to a legal forward
 * pour S -> D, so replaying those forward moves in reverse order is guaranteed
 * to solve the scrambled board.
 *
 * Crucially, the forward source is never a large bottle, honouring the rule
 * that large ("immovable") bottles can only ever *receive* liquid.
 */
export class LevelGenerator {
  /** How many times we re-scramble looking for a board with no pre-solved jar. */
  private static readonly MAX_ATTEMPTS = 200;

  /**
   * @throws if the config violates the color/bottle invariant.
   */
  generate(config: LevelConfig, seed?: number): GeneratedLevel {
    const filledSmall = config.smallBottles - config.emptySmallBottles;

    if (config.emptySmallBottles < 1) {
      throw new Error('Level needs at least one empty small bottle to pour into.');
    }
    if (filledSmall < 0) {
      throw new Error('emptySmallBottles cannot exceed smallBottles.');
    }
    const distinctColors = config.largeBottles + filledSmall;
    if (distinctColors > COLOR_IDS.length) {
      throw new Error(`Level needs ${distinctColors} colors but only ${COLOR_IDS.length} exist.`);
    }

    // Re-scramble until we get a board that is fit to play, reusing one RNG
    // stream so each attempt differs while the whole run stays deterministic for
    // a given seed. "Fit" means it does not already contain a complete jar (a
    // free win) and its recorded solution is legal under the real engine rules
    // (capping included). We keep the best candidate as a fallback.
    const rng = new Rng(seed);
    let candidate = this.scrambleOnce(config, filledSmall, rng);
    for (
      let attempt = 1;
      attempt < LevelGenerator.MAX_ATTEMPTS && !isPlayable(candidate);
      attempt++
    ) {
      candidate = this.scrambleOnce(config, filledSmall, rng);
    }
    return candidate;
  }

  /** Build one scrambled, solvable board (which may still contain a complete jar). */
  private scrambleOnce(config: LevelConfig, filledSmall: number, rng: Rng): GeneratedLevel {
    const colors = rng.shuffle([...COLOR_IDS]).slice(0, config.largeBottles + filledSmall) as ColorId[];

    // ---- Build the solved board ----
    const bottles: Bottle[] = [];
    let id = 0;
    let colorIndex = 0;

    for (let i = 0; i < config.largeBottles; i++) {
      const color = colors[colorIndex++];
      bottles.push(new Bottle(id++, config.largeCapacity, true, fill(color, config.largeCapacity)));
    }
    for (let i = 0; i < filledSmall; i++) {
      const color = colors[colorIndex++];
      bottles.push(new Bottle(id++, config.smallCapacity, false, fill(color, config.smallCapacity)));
    }
    for (let i = 0; i < config.emptySmallBottles; i++) {
      bottles.push(new Bottle(id++, config.smallCapacity, false, []));
    }

    const state = new GameState(bottles);

    // ---- Scramble with inverse pours ----
    const forwardMoves: Move[] = [];
    let lastForward: Move | null = null;

    for (let step = 0; step < config.scrambleMoves; step++) {
      const forward = this.tryInversePour(state, rng, lastForward);
      if (!forward) break; // no legal inverse pour available; stop early
      forwardMoves.push(forward);
      lastForward = forward;
    }

    // Solution = forward moves applied in reverse order.
    const solution = forwardMoves.slice().reverse();

    return { config, state, solution, par: solution.length };
  }

  /**
   * Attempt a single inverse pour, mutating `state`. Returns the equivalent
   * forward move (S -> D) on success, or null if none was possible.
   */
  private tryInversePour(state: GameState, rng: Rng, lastForward: Move | null): Move | null {
    const destinations = rng.shuffle(state.bottles.filter((b) => !b.isEmpty));

    for (const D of destinations) {
      const color = D.topColor as ColorId;
      const run = D.topRunLength;
      // We may take the whole run only if it empties D (else the forward pour
      // would land on a mismatched, non-empty top). Otherwise leave >=1 behind.
      const maxFromDest = run === D.size ? run : run - 1;
      if (maxFromDest < 1) continue;

      const sources = rng.shuffle(
        state.bottles.filter(
          (S) => S.id !== D.id && !S.isLarge && (S.isEmpty || S.topColor !== color),
        ),
      );

      for (const S of sources) {
        const j = Math.min(maxFromDest, S.freeSpace);
        if (j < 1) continue;

        const forward: Move = { from: S.id, to: D.id };
        // Avoid immediately undoing the previous scramble step.
        if (lastForward && forward.from === lastForward.to && forward.to === lastForward.from) {
          continue;
        }

        const amount = rng.int(1, j);
        D.removeTop(amount);
        S.addTop(color, amount);
        return forward;
      }
    }
    return null;
  }

  /**
   * Replays a solution on a clone of the state and reports whether it solves
   * the board using only legal moves. Used by tests and as a runtime guard.
   */
  static verifySolution(state: GameState, solution: Move[]): boolean {
    const work = state.clone();
    for (const move of solution) {
      const from = work.bottle(move.from);
      const to = work.bottle(move.to);
      const result = GameRules.evaluatePour(from, to);
      if (!result.ok) return false;
      const { color, count } = result.plan;
      from.removeTop(count);
      to.addTop(color, count);
      // Mirror the engine: a bottle that becomes complete is sealed, which locks
      // it out of any later pour. A solution that relies on re-using a sealed
      // bottle is illegal in real play, so model capping here too.
      if (GameRules.shouldCap(to)) to.cap();
    }
    return work.isSolved;
  }
}

function fill(color: ColorId, n: number): ColorId[] {
  return Array.from({ length: n }, () => color);
}

/** True if any bottle starts already complete (a full, single-color jar). */
function hasCompleteJar(state: GameState): boolean {
  return state.bottles.some((b) => b.isComplete);
}

/** A level is playable when it has no free pre-solved jar and a legal solution. */
function isPlayable(level: GeneratedLevel): boolean {
  return (
    !hasCompleteJar(level.state) &&
    LevelGenerator.verifySolution(level.state, level.solution)
  );
}
