import { describe, it, expect, vi } from 'vitest';
import { Bottle } from '@/core/models/Bottle';
import { GameState } from '@/core/models/GameState';
import { GameEngine } from '@/core/engine/GameEngine';
import { EventBus } from '@/events/EventBus';

function makeEngine(bottles: Bottle[], bus?: EventBus) {
  return new GameEngine(new GameState(bottles), { level: 1, par: 3, bus });
}

describe('GameEngine', () => {
  it('applies a legal move and counts it', () => {
    const engine = makeEngine([
      new Bottle(0, 4, false, ['red', 'blue', 'blue']),
      new Bottle(1, 4, false, []),
    ]);
    const applied = engine.applyMove({ from: 0, to: 1 });
    expect(applied).toMatchObject({ from: 0, to: 1, color: 'blue', count: 2 });
    expect(engine.moves).toBe(1);
    expect(engine.currentState.bottle(0).segments).toEqual(['red']);
    expect(engine.currentState.bottle(1).segments).toEqual(['blue', 'blue']);
  });

  it('returns null and emits rejection for an illegal move', () => {
    const bus = new EventBus();
    const onReject = vi.fn();
    bus.on('move:rejected', onReject);
    const engine = makeEngine(
      [new Bottle(0, 4, false, ['blue']), new Bottle(1, 4, false, ['red'])],
      bus,
    );
    expect(engine.applyMove({ from: 0, to: 1 })).toBeNull();
    expect(engine.moves).toBe(0);
    expect(onReject).toHaveBeenCalledWith({ from: 0, to: 1, reason: 'color-mismatch' });
  });

  it('caps a destination that becomes complete and emits the event', () => {
    const bus = new EventBus();
    const onCap = vi.fn();
    bus.on('bottle:capped', onCap);
    const engine = makeEngine(
      [new Bottle(0, 2, false, ['red', 'red']), new Bottle(1, 2, false, [])],
      bus,
    );
    // pour 2 reds into empty cap-2 bottle -> complete -> capped
    engine.applyMove({ from: 0, to: 1 });
    expect(engine.currentState.bottle(1).capped).toBe(true);
    expect(onCap).toHaveBeenCalledWith({ bottleId: 1 });
  });

  it('undoes a move, including un-capping', () => {
    const engine = makeEngine([
      new Bottle(0, 2, false, ['red', 'red']),
      new Bottle(1, 2, false, []),
      new Bottle(2, 2, false, ['blue']), // keeps the board unsolved
    ]);
    engine.applyMove({ from: 0, to: 1 });
    expect(engine.currentState.bottle(1).capped).toBe(true);
    expect(engine.undo()).toBe(true);
    expect(engine.moves).toBe(0);
    expect(engine.currentState.bottle(1).capped).toBe(false);
    expect(engine.currentState.bottle(0).segments).toEqual(['red', 'red']);
  });

  it('detects completion and emits level:completed', () => {
    const bus = new EventBus();
    const onDone = vi.fn();
    bus.on('level:completed', onDone);
    const engine = makeEngine(
      [
        new Bottle(0, 2, false, ['blue', 'blue']),
        new Bottle(1, 2, false, ['blue']),
        new Bottle(2, 2, false, ['blue']),
      ],
      bus,
    );
    // Move 2->1 makes bottle1 = [blue,blue] complete, bottle2 empty, bottle0 complete.
    engine.applyMove({ from: 2, to: 1 });
    expect(engine.completed).toBe(true);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('refuses further moves once completed', () => {
    const engine = makeEngine([
      new Bottle(0, 2, false, ['blue', 'blue']),
      new Bottle(1, 2, false, ['blue']),
      new Bottle(2, 2, false, ['blue']),
    ]);
    engine.applyMove({ from: 2, to: 1 });
    expect(engine.completed).toBe(true);
    expect(engine.applyMove({ from: 0, to: 1 })).toBeNull();
  });
});
