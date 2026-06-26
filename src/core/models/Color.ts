/**
 * A color is represented in the domain layer as a stable string id.
 * Rendering concerns (hex values) live in the config/Palette layer so that
 * the core game logic stays free of any presentation detail.
 */
export type ColorId = string;

/** The canonical set of color ids the generator can draw from. */
export const COLOR_IDS = [
  'red',
  'blue',
  'green',
  'yellow',
  'purple',
  'orange',
  'cyan',
  'pink',
  'lime',
  'magenta',
  'teal',
  'brown',
] as const;

export type KnownColorId = (typeof COLOR_IDS)[number];
