import Phaser from 'phaser';
import { GameScene } from '../scenes/GameScene';

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 680;

export function createPhaserConfig(parent: HTMLElement): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#222a4d',
    scale: {
      // RESIZE makes the canvas adopt the real pixel size of its container
      // (capped by CSS) instead of rendering at a fixed size and scaling down.
      // On a phone this means the board is drawn at native size — big and
      // tappable — rather than a fixed 960x680 board shrunk to ~40%.
      mode: Phaser.Scale.RESIZE,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
    },
    scene: [GameScene],
    // Disable audio entirely; this puzzle has no sound and headless test
    // environments often lack an audio device.
    audio: { noAudio: true },
  };
}
