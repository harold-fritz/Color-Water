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
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [GameScene],
    // Disable audio entirely; this puzzle has no sound and headless test
    // environments often lack an audio device.
    audio: { noAudio: true },
  };
}
