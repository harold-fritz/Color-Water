import { GameState } from '../models/GameState';
import type { AppliedMove, Move } from '../models/Move';
import { GameRules, type PourResult } from '../rules/GameRules';
import type { EventBus } from '../../events/EventBus';

export interface GameEngineOptions {
  level: number;
  par: number;
  bus?: EventBus;
}

/**
 * The authoritative model for a single level in play.
 *
 * Responsibilities:
 *  - validate & apply pours (delegating the rules to GameRules)
 *  - count moves (the score is the number of pours; fewer is better)
 *  - cap bottles that become complete
 *  - keep an undo history
 *  - detect the win condition
 *  - broadcast everything that happens through the EventBus
 *
 * It has no knowledge of Phaser or the DOM.
 */
export class GameEngine {
  readonly level: number;
  readonly par: number;

  private state: GameState;
  private bus?: EventBus;
  private history: AppliedMove[] = [];
  private _completed = false;

  constructor(state: GameState, opts: GameEngineOptions) {
    this.state = state;
    this.level = opts.level;
    this.par = opts.par;
    this.bus = opts.bus;
  }

  get currentState(): GameState {
    return this.state;
  }

  get moves(): number {
    return this.history.length;
  }

  get completed(): boolean {
    return this._completed;
  }

  get canUndo(): boolean {
    return this.history.length > 0 && !this._completed;
  }

  /** Pure check used by views to highlight valid targets. */
  evaluate(move: Move): PourResult {
    return GameRules.evaluatePour(this.state.bottle(move.from), this.state.bottle(move.to));
  }

  /**
   * Attempt a pour. On success the state mutates, an `AppliedMove` is recorded,
   * any newly-completed bottle is capped, and the relevant events are emitted.
   * Returns the applied move, or null when the move is illegal.
   */
  applyMove(move: Move): AppliedMove | null {
    if (this._completed) return null;

    const from = this.state.bottle(move.from);
    const to = this.state.bottle(move.to);
    const result = GameRules.evaluatePour(from, to);

    if (!result.ok) {
      this.bus?.emit('move:rejected', { from: move.from, to: move.to, reason: result.reason });
      return null;
    }

    const { color, count } = result.plan;
    from.removeTop(count);
    to.addTop(color, count);

    let cappedDestination = false;
    if (GameRules.shouldCap(to)) {
      to.cap();
      cappedDestination = true;
    }

    const applied: AppliedMove = { from: move.from, to: move.to, color, count, cappedDestination };
    this.history.push(applied);

    this.bus?.emit('move:applied', {
      move: applied,
      moves: this.moves,
      state: this.state.snapshot(),
    });
    if (cappedDestination) {
      this.bus?.emit('bottle:capped', { bottleId: to.id });
    }
    this.bus?.emit('stats:updated', { level: this.level, moves: this.moves, par: this.par });

    this.checkCompletion();
    return applied;
  }

  /** Revert the last applied move (capping is reversible because we recorded it). */
  undo(): boolean {
    if (!this.canUndo) return false;
    const last = this.history.pop() as AppliedMove;

    const from = this.state.bottle(last.from);
    const to = this.state.bottle(last.to);

    // Un-cap if this move was what sealed the destination.
    if (last.cappedDestination) to.uncap();

    to.removeTop(last.count);
    from.addTop(last.color, last.count);

    this.bus?.emit('move:undone', { state: this.state.snapshot(), moves: this.moves });
    this.bus?.emit('stats:updated', { level: this.level, moves: this.moves, par: this.par });
    return true;
  }

  private checkCompletion(): void {
    if (this._completed) return;
    if (this.state.isSolved) {
      this._completed = true;
      this.bus?.emit('level:completed', {
        level: this.level,
        moves: this.moves,
        par: this.par,
        isBest: false, // decided by ScoreService listeners
      });
    }
  }
}
