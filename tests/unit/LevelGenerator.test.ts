import { describe, it, expect } from 'vitest';
import { LevelGenerator } from '@/core/level/LevelGenerator';
import { getLevelConfig, LEVELS } from '@/config/levels';
import { GameEngine } from '@/core/engine/GameEngine';

const generator = new LevelGenerator();

describe('LevelGenerator', () => {
  it('level 1 has 2 immovable large bottles and 6 small bottles', () => {
    const { state } = generator.generate(getLevelConfig(1), 123);
    const large = state.bottles.filter((b) => b.isLarge);
    const small = state.bottles.filter((b) => !b.isLarge);
    expect(large).toHaveLength(2);
    expect(small).toHaveLength(6);
    expect(large.every((b) => b.isLarge)).toBe(true);
  });

  it('scrambles the board away from the solved state', () => {
    const { state } = generator.generate(getLevelConfig(1), 7);
    expect(state.isSolved).toBe(false);
  });

  it('produces a solution that actually solves every defined level, across many seeds', () => {
    for (const config of LEVELS) {
      for (let seed = 1; seed <= 40; seed++) {
        const level = generator.generate(config, seed);
        expect(
          LevelGenerator.verifySolution(level.state, level.solution),
          `level ${config.level} seed ${seed} should be solvable`,
        ).toBe(true);
      }
    }
  });

  it('the recorded solution never uses a large bottle as a source', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const level = generator.generate(getLevelConfig(1), seed);
      const largeIds = new Set(level.state.bottles.filter((b) => b.isLarge).map((b) => b.id));
      for (const move of level.solution) {
        expect(largeIds.has(move.from)).toBe(false);
      }
    }
  });

  it('replaying the solution through the real engine reaches completion', () => {
    const level = generator.generate(getLevelConfig(2), 99);
    const engine = new GameEngine(level.state.clone(), { level: 2, par: level.par });
    for (const move of level.solution) {
      const applied = engine.applyMove(move);
      expect(applied, `move ${move.from}->${move.to} should be legal`).not.toBeNull();
    }
    expect(engine.completed).toBe(true);
  });

  it('par equals the solution length and is positive', () => {
    const level = generator.generate(getLevelConfig(1), 5);
    expect(level.par).toBe(level.solution.length);
    expect(level.par).toBeGreaterThan(0);
  });

  it('throws when colors exceed the palette', () => {
    expect(() =>
      generator.generate({
        level: 99,
        largeBottles: 6,
        smallBottles: 12,
        emptySmallBottles: 1,
        smallCapacity: 4,
        largeCapacity: 8,
        scrambleMoves: 10,
      }),
    ).toThrow();
  });
});
