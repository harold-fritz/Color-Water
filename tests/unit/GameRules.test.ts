import { describe, it, expect } from 'vitest';
import { Bottle } from '@/core/models/Bottle';
import { GameState } from '@/core/models/GameState';
import { GameRules } from '@/core/rules/GameRules';

describe('GameRules.evaluatePour', () => {
  it('pours the top run onto an empty bottle', () => {
    const from = new Bottle(0, 4, false, ['red', 'blue', 'blue']);
    const to = new Bottle(1, 4, false, []);
    const res = GameRules.evaluatePour(from, to);
    expect(res).toEqual({ ok: true, plan: { color: 'blue', count: 2 } });
  });

  it('limits the pour to the destination free space', () => {
    const from = new Bottle(0, 4, false, ['blue', 'blue', 'blue']);
    const to = new Bottle(1, 4, false, ['blue', 'blue', 'blue']); // 1 free
    const res = GameRules.evaluatePour(from, to);
    expect(res).toEqual({ ok: true, plan: { color: 'blue', count: 1 } });
  });

  it('rejects pouring onto a different color', () => {
    const from = new Bottle(0, 4, false, ['blue']);
    const to = new Bottle(1, 4, false, ['red']);
    expect(GameRules.evaluatePour(from, to)).toEqual({ ok: false, reason: 'color-mismatch' });
  });

  it('rejects large bottles as a source (immovable)', () => {
    const from = new Bottle(0, 8, true, ['blue', 'blue']);
    const to = new Bottle(1, 4, false, []);
    expect(GameRules.evaluatePour(from, to)).toEqual({ ok: false, reason: 'source-large' });
  });

  it('allows pouring INTO a large bottle', () => {
    const from = new Bottle(0, 4, false, ['blue']);
    const to = new Bottle(1, 8, true, ['blue']);
    expect(GameRules.canPour(from, to)).toBe(true);
  });

  it('rejects empty source, same bottle, full and capped destinations', () => {
    const empty = new Bottle(0, 4, false, []);
    const target = new Bottle(1, 4, false, []);
    expect(GameRules.evaluatePour(empty, target).ok).toBe(false);

    const b = new Bottle(2, 4, false, ['red']);
    expect(GameRules.evaluatePour(b, b)).toEqual({ ok: false, reason: 'same-bottle' });

    const src = new Bottle(3, 4, false, ['red']);
    const full = new Bottle(4, 2, false, ['red', 'red']);
    expect(GameRules.evaluatePour(src, full)).toEqual({ ok: false, reason: 'dest-full' });

    const capped = new Bottle(5, 4, false, ['red']);
    capped.cap();
    expect(GameRules.evaluatePour(new Bottle(6, 4, false, ['red']), capped)).toEqual({
      ok: false,
      reason: 'dest-capped',
    });
  });

  it('detects whether any move exists', () => {
    const stuck = new GameState([
      new Bottle(0, 2, false, ['red', 'blue']),
      new Bottle(1, 2, false, ['blue', 'red']),
    ]);
    expect(GameRules.hasAnyMove(stuck)).toBe(false);

    const open = new GameState([
      new Bottle(0, 2, false, ['red']),
      new Bottle(1, 2, false, ['red']),
    ]);
    expect(GameRules.hasAnyMove(open)).toBe(true);
  });
});
