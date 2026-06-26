import type { GameEngine } from '../core/engine/GameEngine';
import type { EventBus } from '../events/EventBus';

/**
 * Mediates player input and the game engine. It owns the two-step selection
 * interaction ("tap a source bottle, then tap a destination") and is entirely
 * free of any rendering concern, so it can be unit tested and reused by any
 * view (Phaser, DOM, or a test harness).
 */
export class GameController {
  private selected: number | null = null;

  constructor(
    private readonly engine: GameEngine,
    private readonly bus: EventBus,
  ) {}

  get selectedBottle(): number | null {
    return this.selected;
  }

  /** Whether a bottle is eligible to be picked up as a pour source. */
  canSelectAsSource(id: number): boolean {
    if (this.engine.completed) return false;
    const b = this.engine.currentState.bottle(id);
    return !b.isEmpty && !b.isLarge && !b.capped;
  }

  /**
   * Handle a tap on a bottle. First tap selects a source; the second tap
   * either pours into the destination, deselects (same bottle), or re-targets
   * the selection to a new valid source.
   */
  tap(id: number): void {
    if (this.engine.completed) return;

    if (this.selected === null) {
      if (this.canSelectAsSource(id)) this.select(id);
      return;
    }

    if (this.selected === id) {
      this.clearSelection();
      return;
    }

    const from = this.selected;
    const applied = this.engine.applyMove({ from, to: id });
    if (applied) {
      this.clearSelection();
    } else {
      // Illegal target: if the tapped bottle could itself be a source,
      // switch the selection to it; otherwise just clear.
      this.clearSelection();
      if (this.canSelectAsSource(id)) this.select(id);
    }
  }

  undo(): void {
    this.clearSelection();
    this.engine.undo();
  }

  private select(id: number): void {
    this.selected = id;
    this.bus.emit('bottle:selected', { bottleId: id });
  }

  clearSelection(): void {
    if (this.selected === null) return;
    const prev = this.selected;
    this.selected = null;
    this.bus.emit('bottle:deselected', { bottleId: prev });
    this.bus.emit('selection:cleared', undefined);
  }
}
