import type { ColorId } from './Color';

/** A pour from one bottle to another. */
export interface Move {
  readonly from: number;
  readonly to: number;
}

/** A move that has been executed, with enough info to undo it. */
export interface AppliedMove extends Move {
  readonly color: ColorId;
  readonly count: number;
  /** Whether the destination became capped as a result of this move. */
  readonly cappedDestination: boolean;
}
