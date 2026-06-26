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

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
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

    const margin = 56;
    const playTop = 58;
    const availH = height - playTop * 2;

    // Large bottles grow with the level, but a side that stacks several is
    // capped so the column never overflows the canvas.
    const gapY = 26;
    const padding2 = 12; // matches BottleView's default 2 * padding
    const fitUnit = maxCap
      ? (availH - gapY * (perSide - 1) - padding2 * perSide) / (maxCap * perSide)
      : 40;
    const hiUnit = Math.max(24, Math.min(46, fitUnit));
    const largeUnit = Math.floor(Phaser.Math.Clamp(24 + level * 2.2, 24, hiUnit));
    const largeWidth = Math.round(Phaser.Math.Clamp(58 + level * 3.5, 58, 108));
    const largeStyle = { unitHeight: largeUnit, largeWidth };

    const leftX = margin + largeWidth / 2;
    const rightX = width - margin - largeWidth / 2;
    this.placeColumn(leftGroup, leftX, height, largeStyle, onTap);
    this.placeColumn(rightGroup, rightX, height, largeStyle, onTap);

    // Small bottles fill the channel between the two large columns.
    const colGap = 28;
    const channelLeft = margin + largeWidth + colGap;
    const channelRight = width - margin - largeWidth - colGap;
    const channelW = channelRight - channelLeft;
    const channelCenter = (channelLeft + channelRight) / 2;

    const smallUnit = 22;
    const smallWidth = 48;
    const step = smallWidth + 22;
    const maxPerRow = Math.max(1, Math.floor(channelW / step));
    const perRow = Math.max(1, Math.min(maxPerRow, small.length));
    const rows = Math.ceil(small.length / perRow);
    const smallH = small.length ? small[0].capacity * smallUnit + padding2 : 0;
    const rowGap = smallH + 34;
    const startY = height / 2 - ((rows - 1) * rowGap) / 2;

    for (let r = 0; r < rows; r++) {
      const rowItems = small.slice(r * perRow, r * perRow + perRow);
      const y = startY + r * rowGap;
      this.spread(rowItems.length, channelCenter, step).forEach((x, i) => {
        const snap = rowItems[i].snapshot();
        const view = new BottleView(this, x, y, snap, onTap, { unitHeight: smallUnit, smallWidth });
        view.setBaselineY(y);
        this.views.set(snap.id, view);
      });
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

  /** Evenly spaced x positions for `count` items centered on `centerX`. */
  private spread(count: number, centerX: number, step: number): number[] {
    const totalWidth = (count - 1) * step;
    const start = centerX - totalWidth / 2;
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
