import { describe, it, expect } from 'vitest';
import { Bottle } from '@/core/models/Bottle';
import { GameState } from '@/core/models/GameState';
import { GameEngine } from '@/core/engine/GameEngine';
import { GameController } from '@/controllers/GameController';
import { EventBus } from '@/events/EventBus';

function setup(bottles: Bottle[]) {
  const bus = new EventBus();
  const engine = new GameEngine(new GameState(bottles), { level: 1, par: 1, bus });
  const controller = new GameController(engine, bus);
  return { bus, engine, controller };
}

describe('GameController', () => {
  it('selects a source on first tap and pours on second tap', () => {
    const { engine, controller } = setup([
      new Bottle(0, 4, false, ['red', 'blue', 'blue']),
      new Bottle(1, 4, false, []),
    ]);
    controller.tap(0);
    expect(controller.selectedBottle).toBe(0);
    controller.tap(1);
    expect(controller.selectedBottle).toBeNull();
    expect(engine.currentState.bottle(1).segments).toEqual(['blue', 'blue']);
  });

  it('does not select empty, large or capped bottles as a source', () => {
    const { controller } = setup([
      new Bottle(0, 8, true, ['red', 'red']), // large
      new Bottle(1, 4, false, []), // empty
    ]);
    controller.tap(0);
    expect(controller.selectedBottle).toBeNull();
    controller.tap(1);
    expect(controller.selectedBottle).toBeNull();
  });

  it('toggles selection off when tapping the same bottle twice', () => {
    const { controller } = setup([
      new Bottle(0, 4, false, ['red']),
      new Bottle(1, 4, false, []),
    ]);
    controller.tap(0);
    controller.tap(0);
    expect(controller.selectedBottle).toBeNull();
  });

  it('re-targets selection to a new valid source on an illegal move', () => {
    const { controller } = setup([
      new Bottle(0, 4, false, ['blue']),
      new Bottle(1, 4, false, ['red']),
    ]);
    controller.tap(0); // select blue source
    controller.tap(1); // illegal pour (red top) -> becomes new source
    expect(controller.selectedBottle).toBe(1);
  });

  it('emits selection events through the bus', () => {
    const { bus, controller } = setup([
      new Bottle(0, 4, false, ['red']),
      new Bottle(1, 4, false, []),
    ]);
    const events: string[] = [];
    bus.on('bottle:selected', () => events.push('selected'));
    bus.on('selection:cleared', () => events.push('cleared'));
    controller.tap(0);
    controller.tap(1);
    expect(events).toContain('selected');
    expect(events).toContain('cleared');
  });
});
