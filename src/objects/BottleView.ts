import Phaser from 'phaser';
import type { BottleSnapshot } from '../core/models/Bottle';
import type { ColorId } from '../core/models/Color';
import { swatch } from '../config/Palette';

/** An in-progress pour: `units` of `color` filling/draining at `fraction` (0..1). */
interface FlowBlock {
  color: ColorId;
  units: number;
  fraction: number;
}

export interface BottleViewStyle {
  unitHeight: number;
  smallWidth: number;
  largeWidth: number;
  padding: number;
}

const DEFAULT_STYLE: BottleViewStyle = {
  unitHeight: 24,
  smallWidth: 50,
  largeWidth: 66,
  padding: 6,
};

/**
 * Phaser view for a single bottle. It is a pure renderer: it draws whatever
 * snapshot it is handed and forwards taps to a callback. It holds no game
 * state and knows nothing about the rules.
 */
export class BottleView extends Phaser.GameObjects.Container {
  readonly bottleId: number;
  readonly isLarge: boolean;
  readonly capacity: number;

  private style: BottleViewStyle;
  private glass: Phaser.GameObjects.Graphics;
  private liquid: Phaser.GameObjects.Graphics;
  private gloss: Phaser.GameObjects.Graphics;
  private capG: Phaser.GameObjects.Graphics;
  private hit: Phaser.GameObjects.Rectangle;
  private selected = false;
  private lastSnapshot: BottleSnapshot;

  readonly bodyWidth: number;
  readonly bodyHeight: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    snapshot: BottleSnapshot,
    onTap: (id: number) => void,
    style: Partial<BottleViewStyle> = {},
  ) {
    super(scene, x, y);
    this.style = { ...DEFAULT_STYLE, ...style };
    this.bottleId = snapshot.id;
    this.isLarge = snapshot.isLarge;
    this.capacity = snapshot.capacity;
    this.lastSnapshot = snapshot;

    this.bodyWidth = snapshot.isLarge ? this.style.largeWidth : this.style.smallWidth;
    this.bodyHeight = snapshot.capacity * this.style.unitHeight + this.style.padding * 2;

    this.glass = scene.add.graphics();
    this.liquid = scene.add.graphics();
    this.gloss = scene.add.graphics();
    this.capG = scene.add.graphics();

    this.hit = scene.add.rectangle(0, 0, this.bodyWidth + 8, this.bodyHeight + 18, 0xffffff, 0);
    this.hit.setInteractive({ useHandCursor: true });
    this.hit.on('pointerdown', () => onTap(this.bottleId));

    this.add([this.glass, this.liquid, this.gloss, this.capG, this.hit]);
    this.setSize(this.bodyWidth, this.bodyHeight);
    this.render(snapshot);
    scene.add.existing(this);
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    this.render(this.lastSnapshot);
    this.scene.tweens.add({
      targets: this,
      y: selected ? this.y - 10 : this.baselineY,
      duration: 120,
      ease: 'Quad.easeOut',
    });
  }

  private baselineY = 0;
  setBaselineY(y: number): void {
    this.baselineY = y;
    this.y = y;
  }

  /** The resting Y this bottle returns to after a lift or pour. */
  get homeY(): number {
    return this.baselineY;
  }

  render(snapshot: BottleSnapshot): void {
    this.lastSnapshot = snapshot;
    this.paint(snapshot.segments, snapshot.capped);
  }

  /**
   * Render mid-pour: `stable` is the settled liquid and `flow` is a partial
   * block of liquid on top of it (rising on the receiver, draining on the
   * giver). Used only by the pour animation; never caps.
   */
  renderFlow(stable: ColorId[], color: ColorId, units: number, fraction: number): void {
    this.paint(stable, false, { color, units, fraction });
  }

  private paint(segments: ColorId[], capped: boolean, flow?: FlowBlock): void {
    const { unitHeight, padding } = this.style;
    const w = this.bodyWidth;
    const h = this.bodyHeight;
    const left = -w / 2;
    const top = -h / 2;
    const radius = Math.min(16, w / 3);

    // --- glass ---
    this.glass.clear();
    this.glass.lineStyle(3, this.selected ? 0xffffff : 0x9fb4d8, this.selected ? 1 : 0.9);
    this.glass.fillStyle(0xffffff, 0.06);
    this.glass.fillRoundedRect(left, top, w, h, radius);
    this.glass.strokeRoundedRect(left, top, w, h, radius);

    // --- liquid segments (bottom -> top) ---
    this.liquid.clear();
    const innerW = w - padding * 2;
    const innerLeft = left + padding;
    const bottom = top + h - padding;
    const innerR = Math.max(0, radius - padding);
    segments.forEach((color, i) => {
      const segTop = bottom - (i + 1) * unitHeight;
      const isBottom = i === 0;
      const r = isBottom ? innerR : 0;
      this.liquid.fillStyle(swatch(color).hex, 1);
      this.liquid.fillRoundedRect(innerLeft, segTop, innerW, unitHeight, {
        tl: 0,
        tr: 0,
        bl: r,
        br: r,
      });
    });

    // --- in-progress pour block on top of the settled liquid ---
    let filledH = segments.length * unitHeight;
    if (flow && flow.units > 0 && flow.fraction > 0) {
      const flowH = flow.units * unitHeight * flow.fraction;
      const blockTop = bottom - filledH - flowH;
      const r = segments.length === 0 ? innerR : 0;
      this.liquid.fillStyle(swatch(flow.color).hex, 1);
      this.liquid.fillRoundedRect(innerLeft, blockTop, innerW, flowH, { tl: 0, tr: 0, bl: r, br: r });
      filledH += flowH;
    }

    // Cylindrical shading over the whole filled column: a soft highlight down
    // the left and a shadow down the right make it read as a round 3D tube.
    if (filledH > 0) {
      const liqTop = bottom - filledH;
      const bandW = innerW * 0.24;
      this.liquid.fillStyle(0xffffff, 0.16);
      this.liquid.fillRoundedRect(innerLeft, liqTop, bandW, filledH, { tl: 0, tr: 0, bl: innerR, br: 0 });
      this.liquid.fillStyle(0x000000, 0.16);
      this.liquid.fillRoundedRect(innerLeft + innerW - bandW, liqTop, bandW, filledH, {
        tl: 0,
        tr: 0,
        bl: 0,
        br: innerR,
      });
      // Bright meniscus line on the liquid surface.
      this.liquid.fillStyle(0xffffff, 0.22);
      this.liquid.fillRect(innerLeft, liqTop, innerW, 2);
    }

    // --- glassy shine (sits above the liquid, below the cap) ---
    this.gloss.clear();
    const shineW = Math.max(4, w * 0.16);
    this.gloss.fillStyle(0xffffff, 0.16);
    this.gloss.fillRoundedRect(left + w * 0.17, top + padding, shineW, h - padding * 2, shineW / 2);
    const streakW = Math.max(3, w * 0.06);
    this.gloss.fillStyle(0xffffff, 0.1);
    this.gloss.fillRoundedRect(left + w * 0.74, top + padding, streakW, h - padding * 2, streakW / 2);

    // --- cap (when sealed) ---
    this.capG.clear();
    if (capped) {
      const capH = 12;
      this.capG.fillStyle(0x3a3f55, 1);
      this.capG.fillRoundedRect(left + 2, top - capH + 2, w - 4, capH + 6, 5);
      this.capG.fillStyle(0xb0b8d0, 1);
      this.capG.fillRoundedRect(left + 6, top - capH - 2, w - 12, capH, 4);
    }
  }

  destroy(fromScene?: boolean): void {
    this.glass.destroy();
    this.liquid.destroy();
    this.gloss.destroy();
    this.capG.destroy();
    this.hit.destroy();
    super.destroy(fromScene);
  }
}
