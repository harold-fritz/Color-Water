import Phaser from 'phaser';
import { BottleView } from '../objects/BottleView';
import type { Bottle } from '../core/models/Bottle';
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

    // Re-lay the board whenever the canvas changes size (rotation, resize,
    // mobile chrome show/hide) so it always fits the available space.
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private handleResize(): void {
    this.views.forEach((v) => v.destroy());
    this.views.clear();
    this.buildBoard();
  }

  private buildBoard(): void {
    const { engine, controller, generated } = this.ctx;
    const bottles = engine.currentState.bottles;
    const large = bottles.filter((b) => b.isLarge);
    const small = bottles.filter((b) => !b.isLarge);
    const level = generated.config.level;

    const width = this.scale.width;
    const height = this.scale.height;
    const onTap = (id: number) => controller.tap(id);

    // Split the large (immovable) bottles into a left and a right group so they
    // flank the small bottles instead of sitting on top of them.
    const leftGroup = large.slice(0, Math.ceil(large.length / 2));
    const rightGroup = large.slice(leftGroup.length);
    const perSide = Math.max(1, leftGroup.length, rightGroup.length);
    const maxCap = large.length ? Math.max(...large.map((b) => b.capacity)) : 0;

    // Margins scale with the canvas so the board breathes on a wide desktop but
    // stays compact on a narrow phone.
    const margin = Math.round(Phaser.Math.Clamp(width * 0.058, 16, 56));
    const playTop = Math.round(Phaser.Math.Clamp(height * 0.085, 24, 58));
    const availH = height - playTop * 2;

    // Large bottles grow with the level, but are capped so a stacked side-column
    // never overflows vertically and never eats too much of a narrow width.
    const gapY = 26;
    const padding2 = 12; // matches BottleView's default 2 * padding
    const fitUnit = maxCap
      ? (availH - gapY * (perSide - 1) - padding2 * perSide) / (maxCap * perSide)
      : 40;
    // Grow with the level up to a cap, but never above what actually fits the
    // height (so a short landscape phone shrinks them instead of clipping).
    const hiUnit = Math.min(46, fitUnit);
    const largeUnit = Math.max(8, Math.floor(Math.min(24 + level * 2.2, hiUnit)));
    const largeWidth = Math.round(
      Phaser.Math.Clamp(58 + level * 3.5, 50, Math.min(108, width * 0.18)),
    );
    const largeStyle = { unitHeight: largeUnit, largeWidth };

    const leftX = margin + largeWidth / 2;
    const rightX = width - margin - largeWidth / 2;
    this.placeColumn(leftGroup, leftX, height, largeStyle, onTap);
    this.placeColumn(rightGroup, rightX, height, largeStyle, onTap);

    // Small bottles fill the channel between the two large columns. They are
    // arranged in a grid whose cell size — and therefore bottle size — adapts to
    // the available space so they never overlap, only shrink, on a phone.
    const colGap = Math.round(Phaser.Math.Clamp(width * 0.02, 10, 28));
    const channelLeft = margin + largeWidth + colGap;
    const channelRight = width - margin - largeWidth - colGap;
    const channelW = channelRight - channelLeft;

    if (small.length > 0) {
      const cap = small[0].capacity;
      // Pick the column count that best fills the channel at a comfortable width.
      const perRow = Math.max(1, Math.min(small.length, Math.floor(channelW / 60)));
      const rows = Math.ceil(small.length / perRow);
      const cellW = channelW / perRow;
      const cellH = availH / rows;

      // Bottle size fits the cell but never exceeds the desktop design size.
      const smallWidth = Math.max(22, Math.min(48, Math.floor(cellW - 12)));
      const smallUnit = Math.max(12, Math.min(22, Math.floor((cellH - padding2 - 18) / cap)));

      const gridTop = height / 2 - (rows * cellH) / 2;
      for (let i = 0; i < small.length; i++) {
        const r = Math.floor(i / perRow);
        const c = i % perRow;
        const itemsInRow = Math.min(perRow, small.length - r * perRow);
        // Center a short final row within the channel.
        const rowLeft = channelLeft + (channelW - itemsInRow * cellW) / 2;
        const x = rowLeft + c * cellW + cellW / 2;
        const y = gridTop + r * cellH + cellH / 2;
        const snap = small[i].snapshot();
        const view = new BottleView(this, x, y, snap, onTap, { unitHeight: smallUnit, smallWidth });
        view.setBaselineY(y);
        this.views.set(snap.id, view);
      }
    }
  }

  /** Stack `group` as a vertically centered column at x. */
  private placeColumn(
    group: Bottle[],
    x: number,
    height: number,
    style: { unitHeight: number; largeWidth: number },
    onTap: (id: number) => void,
  ): void {
    if (group.length === 0) return;
    const gapY = 26;
    const padding2 = 12;
    const heights = group.map((b) => b.capacity * style.unitHeight + padding2);
    const total = heights.reduce((a, b) => a + b, 0) + gapY * (group.length - 1);
    let cursor = height / 2 - total / 2;
    group.forEach((b, i) => {
      const cy = cursor + heights[i] / 2;
      const snap = b.snapshot();
      const view = new BottleView(this, x, cy, snap, onTap, style);
      view.setBaselineY(cy);
      this.views.set(snap.id, view);
      cursor += heights[i] + gapY;
    });
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
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.unsubscribers.forEach((off) => off());
    this.unsubscribers = [];
    this.views.forEach((v) => v.destroy());
    this.views.clear();
  }
}
