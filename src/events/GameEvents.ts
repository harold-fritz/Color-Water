import type { AppliedMove } from '../core/models/Move';
import type { GameStateSnapshot } from '../core/models/GameState';
import type { PourRejection } from '../core/rules/GameRules';

/** Strongly-typed catalogue of every event flowing through the EventBus. */
export interface GameEventMap {
  // ----- application / flow -----
  'app:start-requested': { playerName: string };
  'level:loaded': { level: number; par: number; state: GameStateSnapshot };
  'level:completed': { level: number; moves: number; par: number; isBest: boolean };
  'game:reset': { level: number };

  // ----- selection / input -----
  'bottle:selected': { bottleId: number };
  'bottle:deselected': { bottleId: number };
  'selection:cleared': undefined;

  // ----- moves -----
  'move:applied': { move: AppliedMove; moves: number; state: GameStateSnapshot };
  'move:rejected': { from: number; to: number; reason: PourRejection };
  'move:undone': { state: GameStateSnapshot; moves: number };

  // ----- bottle lifecycle -----
  'bottle:capped': { bottleId: number };

  // ----- stats -----
  'stats:updated': { level: number; moves: number; par: number };
}

export type GameEventName = keyof GameEventMap;
