/** Holds the current player's name and remembers it between sessions. */
export class PlayerService {
  private static KEY = 'color-water:player';
  private _name = '';

  constructor() {
    try {
      this._name = globalThis.localStorage?.getItem(PlayerService.KEY) ?? '';
    } catch {
      this._name = '';
    }
  }

  get name(): string {
    return this._name;
  }

  setName(name: string): void {
    this._name = name.trim();
    try {
      globalThis.localStorage?.setItem(PlayerService.KEY, this._name);
    } catch {
      /* ignore */
    }
  }

  get hasName(): boolean {
    return this._name.length > 0;
  }
}
