export interface LevelScore {
  bestMoves: number;
  par: number;
}

/**
 * Persists the best (lowest) move count per level. The score *is* the number
 * of bottle moves — fewer is better. Falls back to an in-memory store when
 * localStorage is unavailable (e.g. during headless tests).
 */
export class ScoreService {
  private static KEY = 'color-water:scores';
  private memory: Record<number, LevelScore> = {};

  private load(): Record<number, LevelScore> {
    try {
      const raw = globalThis.localStorage?.getItem(ScoreService.KEY);
      return raw ? (JSON.parse(raw) as Record<number, LevelScore>) : {};
    } catch {
      return { ...this.memory };
    }
  }

  private save(scores: Record<number, LevelScore>): void {
    this.memory = scores;
    try {
      globalThis.localStorage?.setItem(ScoreService.KEY, JSON.stringify(scores));
    } catch {
      /* ignore – memory copy already updated */
    }
  }

  best(level: number): LevelScore | undefined {
    return this.load()[level];
  }

  /** Record a finished level. Returns true when it is a new personal best. */
  record(level: number, moves: number, par: number): boolean {
    const scores = this.load();
    const prev = scores[level];
    const isBest = !prev || moves < prev.bestMoves;
    if (isBest) {
      scores[level] = { bestMoves: moves, par };
      this.save(scores);
    }
    return isBest;
  }
}
