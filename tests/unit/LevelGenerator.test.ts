import { describe, it, expect } from 'vitest';
import { LevelGenerator } from '@/core/level/LevelGenerator';
import { getLevelConfig, LEVELS } from '@/config/levels';
import { GameEngine } from '@/core/engine/GameEngine';
import { COLOR_IDS } from '@/core/models/Color';

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

  it('never starts a level with an already-complete jar, across many seeds', () => {
    for (const config of LEVELS) {
      for (let seed = 1; seed <= 80; seed++) {
        const { state } = generator.generate(config, seed);
        const complete = state.bottles.filter((b) => b.isComplete);
        expect(
          complete,
          `level ${config.level} seed ${seed} starts with complete jar(s): ${complete
            .map((b) => b.id)
            .join(', ')}`,
        ).toHaveLength(0);
      }
    }
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

  it('every generated solution is legal in the real engine (capping included), across many seeds', () => {
    // The engine seals a bottle the moment it is complete, locking it out of
    // later pours. Generated solutions must respect that, not just the looser
    // pure-pour rules.
    for (const config of LEVELS) {
      for (let seed = 1; seed <= 60; seed++) {
        const level = generator.generate(config, seed);
        const engine = new GameEngine(level.state.clone(), { level: config.level, par: level.par });
        for (const move of level.solution) {
          const applied = engine.applyMove(move);
          expect(
            applied,
            `level ${config.level} seed ${seed}: move ${move.from}->${move.to} should be legal`,
          ).not.toBeNull();
        }
        expect(engine.completed, `level ${config.level} seed ${seed} should complete`).toBe(true);
      }
    }
  });

  it('par equals the solution length and is positive', () => {
    const level = generator.generate(getLevelConfig(1), 5);
    expect(level.par).toBe(level.solution.length);
    expect(level.par).toBeGreaterThan(0);
  });

  it('keeps generating playable levels well past the hand-tuned curve', () => {
    // Levels beyond LEVELS are extrapolated; this used to ask for more colors
    // than the palette has and threw, stranding the player at level 6.
    for (let level = LEVELS.length + 1; level <= 40; level++) {
      const config = getLevelConfig(level);
      expect(config.largeBottles + (config.smallBottles - config.emptySmallBottles)).toBeLessThanOrEqual(
        COLOR_IDS.length,
      );
      const gen = generator.generate(config, level);
      expect(gen.state.bottles.some((b) => b.isComplete), `level ${level} pre-solved jar`).toBe(false);
      const engine = new GameEngine(gen.state.clone(), { level, par: gen.par });
      for (const m of gen.solution) {
        expect(engine.applyMove(m), `level ${level} move ${m.from}->${m.to}`).not.toBeNull();
      }
      expect(engine.completed, `level ${level} should complete`).toBe(true);
    }
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
