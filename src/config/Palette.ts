import type { ColorId } from '../core/models/Color';

/** Maps domain color ids to presentation values. Rendering-only concern. */
export interface Swatch {
  readonly hex: number; // 0xRRGGBB for Phaser
  readonly css: string; // for DOM / CSS usage
}

export const PALETTE: Record<ColorId, Swatch> = {
  red: { hex: 0xe6394a, css: '#e6394a' },
  blue: { hex: 0x2f6fed, css: '#2f6fed' },
  green: { hex: 0x2faf5a, css: '#2faf5a' },
  yellow: { hex: 0xf4c430, css: '#f4c430' },
  purple: { hex: 0x8a4fd6, css: '#8a4fd6' },
  orange: { hex: 0xf08a24, css: '#f08a24' },
  cyan: { hex: 0x2bc6d6, css: '#2bc6d6' },
  pink: { hex: 0xf06fb0, css: '#f06fb0' },
  lime: { hex: 0x9fd62b, css: '#9fd62b' },
  magenta: { hex: 0xd62bb0, css: '#d62bb0' },
  teal: { hex: 0x1f8f8f, css: '#1f8f8f' },
  brown: { hex: 0x9c6b3c, css: '#9c6b3c' },
};

export function swatch(color: ColorId): Swatch {
  return PALETTE[color] ?? { hex: 0xffffff, css: '#ffffff' };
}
