import { GameEngine } from '../engine/GameEngine';
import { LevelGenerator, type GeneratedLevel } from './LevelGenerator';
import { getLevelConfig } from '../../config/levels';
import type { EventBus } from '../../events/EventBus';

/**
 * Creates playable levels and wires a GameEngine to the EventBus. Keeps the
 * generation/seed policy in one place so scenes & tests stay simple.
 */
export class LevelService {
  private generator = new LevelGenerator();

  build(level: number, seed?: number): GeneratedLevel {
    const config = getLevelConfig(level);
    const generated = this.generator.generate(config, seed);

    // Runtime guard: never hand the player an unsolvable board.
    if (!LevelGenerator.verifySolution(generated.state, generated.solution)) {
      throw new Error(`Generated level ${level} failed its solvability check.`);
    }
    return generated;
  }

  createEngine(level: number, bus: EventBus, seed?: number): { engine: GameEngine; generated: GeneratedLevel } {
    const generated = this.build(level, seed);
    const engine = new GameEngine(generated.state, { level, par: generated.par, bus });
    return { engine, generated };
  }
}
