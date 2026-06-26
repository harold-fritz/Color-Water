import Phaser from 'phaser';
import { BottleView } from '../objects/BottleView';
import type { EventBus } from '../events/EventBus';
import type { GameEngine } from '../core/engine/GameEngine';
import type { GameController } from '../controllers/GameController';
import type { GeneratedLevel } from '../core/level/LevelGenerator';

export interface GameSceneContext {
  bus: EventBus;
  engine: GameEngine;
  controller: GameController;
  generated: GeneratedLevel;
}

/**
 * Renders the board and routes taps to the controller. All game logic lives in
 * the engine/controller; this scene only listens to bus events and repaints.
 */
export class GameScene extends Phaser.Scene {
  static KEY = 'GameScene';

  private views = new Map<number, BottleView>();
  private unsubscribers: Array<() => void> = [];
  private ctx!: GameSceneContext;

  constructor() {
    super({ key: GameScene.KEY });
  }

  create(): void {
    this.ctx = this.registry.get('ctx') as GameSceneContext;
    this.cameras.main.setBackgroundColor('#222a4d');

    this.buildBoard();
    this.subscribe();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private buildBoard(): void {
    const { engine, controller } = this.ctx;
    const bottles = engine.currentState.bottles;
    const large = bottles.filter((b) => b.isLarge);
    const small = bottles.filter((b) => !b.isLarge);

    const width = this.scale.width;
    const onTap = (id: number) => controller.tap(id);

    // Large (immovable) bottles across the top.
    const largeY = 150;
    this.layoutRow(large.length, width, 120).forEach((x, i) => {
      const snap = large[i].snapshot();
      const view = new BottleView(this, x, largeY, snap, onTap, { unitHeight: 22 });
      view.setBaselineY(largeY);
      this.views.set(snap.id, view);
    });

    // Small bottles in a centered grid, max 6 per row.
    const perRow = 6;
    const startY = 360;
    const rowGap = 150;
    for (let r = 0; r * perRow < small.length; r++) {
      const rowItems = small.slice(r * perRow, r * perRow + perRow);
      const y = startY + r * rowGap;
      this.layoutRow(rowItems.length, width, 78).forEach((x, i) => {
        const snap = rowItems[i].snapshot();
        const view = new BottleView(this, x, y, snap, onTap, { unitHeight: 22 });
        view.setBaselineY(y);
        this.views.set(snap.id, view);
      });
    }
  }

  /** Evenly spaced, horizontally centered x positions for `count` items. */
  private layoutRow(count: number, width: number, step: number): number[] {
    const totalWidth = (count - 1) * step;
    const start = width / 2 - totalWidth / 2;
    return Array.from({ length: count }, (_, i) => start + i * step);
  }

  private repaintAll(): void {
    for (const b of this.ctx.engine.currentState.bottles) {
      this.views.get(b.id)?.render(b.snapshot());
    }
  }

  private subscribe(): void {
    const { bus } = this.ctx;
    this.unsubscribers.push(
      bus.on('move:applied', () => this.repaintAll()),
      bus.on('move:undone', () => this.repaintAll()),
      bus.on('bottle:selected', ({ bottleId }) => this.views.get(bottleId)?.setSelected(true)),
      bus.on('bottle:deselected', ({ bottleId }) => this.views.get(bottleId)?.setSelected(false)),
      bus.on('bottle:capped', ({ bottleId }) => {
        const v = this.views.get(bottleId);
        if (v) this.cameras.main.flash(150, 255, 255, 255);
      }),
    );
  }

  private cleanup(): void {
    this.unsubscribers.forEach((off) => off());
    this.unsubscribers = [];
    this.views.forEach((v) => v.destroy());
    this.views.clear();
  }
}
