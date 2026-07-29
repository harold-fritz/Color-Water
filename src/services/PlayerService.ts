/**
 * Holds the current player's name and the level they have reached, and
 * remembers both between sessions via localStorage so a refresh resumes the
 * game instead of starting over.
 */
export class PlayerService {
  private static NAME_KEY = 'color-water:player';
  private static LEVEL_KEY = 'color-water:level';
  private _name = '';
  private _level = 1;

  constructor() {
    try {
      this._name = globalThis.localStorage?.getItem(PlayerService.NAME_KEY) ?? '';
      const stored = Number(globalThis.localStorage?.getItem(PlayerService.LEVEL_KEY));
      this._level = Number.isFinite(stored) && stored >= 1 ? Math.floor(stored) : 1;
    } catch {
      this._name = '';
      this._level = 1;
    }
  }

  get name(): string {
    return this._name;
  }

  get hasName(): boolean {
    return this._name.length > 0;
  }

  /** The level the player should resume on. */
  get level(): number {
    return this._level;
  }

  setName(name: string): void {
    this._name = name.trim();
    try {
      globalThis.localStorage?.setItem(PlayerService.NAME_KEY, this._name);
    } catch {
      /* ignore */
    }
  }

  setLevel(level: number): void {
    this._level = Math.max(1, Math.floor(level));
    try {
      globalThis.localStorage?.setItem(PlayerService.LEVEL_KEY, String(this._level));
    } catch {
      /* ignore */
    }
  }

  /** Forget the current player entirely (used when switching to a new user). */
  clear(): void {
    this._name = '';
    this._level = 1;
    try {
      globalThis.localStorage?.removeItem(PlayerService.NAME_KEY);
      globalThis.localStorage?.removeItem(PlayerService.LEVEL_KEY);
    } catch {
      /* ignore */
    }
  }
}
