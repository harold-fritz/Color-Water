import Phaser from 'phaser';
import { EventBus } from './events/EventBus';
import { GameController } from './controllers/GameController';
import { GameEngine } from './core/engine/GameEngine';
import { LevelService } from './core/level/LevelService';
import type { GeneratedLevel } from './core/level/LevelGenerator';
import { ScoreService } from './services/ScoreService';
import { PlayerService } from './services/PlayerService';
import { createPhaserConfig } from './config/GameConfig';
import { GameScene, type GameSceneContext } from './scenes/GameScene';

/**
 * Top-level orchestrator. Owns the DOM "shell" (start / name / HUD / win),
 * the shared EventBus, the per-level engine + controller, and the Phaser game.
 * It is the only place that knows about every layer; the layers themselves stay
 * decoupled and talk through the bus.
 */
export class App {
  private bus = new EventBus();
  private levels = new LevelService();
  private scores = new ScoreService();
  private player = new PlayerService();

  private game?: Phaser.Game;
  private engine?: GameEngine;
  private controller?: GameController;
  private generated?: GeneratedLevel;

  private currentLevel = 1;
  private currentSeed = 0;

  private el = {
    startScreen: this.byId('start-screen'),
    startButton: this.byId('start-button'),
    nameScreen: this.byId('name-screen'),
    nameInput: this.byId<HTMLInputElement>('name-input'),
    nameSubmit: this.byId('name-submit'),
    nameError: this.byId('name-error'),
    gameScreen: this.byId('game-screen'),
    canvas: this.byId('game-canvas'),
    hudPlayer: this.byId('hud-player'),
    hudLevel: this.byId('hud-level'),
    hudMoves: this.byId('hud-moves'),
    hudPar: this.byId('hud-par'),
    hudBest: this.byId('hud-best'),
    undoButton: this.byId('undo-button'),
    resetButton: this.byId('reset-button'),
    winBanner: this.byId('win-banner'),
    winMoves: this.byId('win-moves'),
    winPar: this.byId('win-par'),
    winBest: this.byId('win-best'),
    replayButton: this.byId('replay-button'),
    nextButton: this.byId('next-button'),
  };

  start(): void {
    this.wireShell();
    this.wireBus();
    if (this.player.hasName) {
      this.el.nameInput.value = this.player.name;
    }
    this.exposeTestApi();
  }

  // ---------------------------------------------------------------- shell ----
  private wireShell(): void {
    this.el.startButton.addEventListener('click', () => {
      this.show(this.el.startScreen, false);
      this.show(this.el.nameScreen, true);
      this.el.nameInput.focus();
    });

    const submitName = () => this.submitName();
    this.el.nameSubmit.addEventListener('click', submitName);
    this.el.nameInput.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') submitName();
    });

    this.el.undoButton.addEventListener('click', () => this.controller?.undo());
    this.el.resetButton.addEventListener('click', () => this.startLevel(this.currentLevel, this.currentSeed));
    this.el.replayButton.addEventListener('click', () => this.startLevel(this.currentLevel, this.currentSeed));
    this.el.nextButton.addEventListener('click', () => this.startLevel(this.currentLevel + 1));
  }

  private submitName(): void {
    const name = this.el.nameInput.value.trim();
    if (!name) {
      this.show(this.el.nameError, true);
      return;
    }
    this.show(this.el.nameError, false);
    this.player.setName(name);
    this.show(this.el.nameScreen, false);
    this.show(this.el.gameScreen, true);
    this.el.hudPlayer.textContent = this.player.name;
    this.startLevel(1);
  }

  // ---------------------------------------------------------------- flow -----
  private startLevel(level: number, seed = randomSeed()): void {
    this.currentLevel = level;
    this.currentSeed = seed;
    this.show(this.el.winBanner, false);

    const { engine, generated } = this.levels.createEngine(level, this.bus, seed);
    const controller = new GameController(engine, this.bus);
    this.engine = engine;
    this.controller = controller;
    this.generated = generated;

    const ctx: GameSceneContext = { bus: this.bus, engine, controller, generated };

    this.bus.emit('level:loaded', { level, par: generated.par, state: engine.currentState.snapshot() });
    this.updateHud(0, generated.par);

    if (!this.game) {
      const game = new Phaser.Game(createPhaserConfig(this.el.canvas));
      game.registry.set('ctx', ctx);
      this.game = game;
    } else {
      this.game.registry.set('ctx', ctx);
      const scene = this.game.scene.getScene(GameScene.KEY);
      if (scene) this.game.scene.getScene(GameScene.KEY).scene.restart();
      else this.game.scene.start(GameScene.KEY);
    }
  }

  private wireBus(): void {
    this.bus.on('stats:updated', ({ moves, par }) => this.updateHud(moves, par));
    this.bus.on('level:completed', ({ level, moves, par }) => {
      const isBest = this.scores.record(level, moves, par);
      this.showWin(moves, par, isBest);
      this.refreshBest();
    });
  }

  private updateHud(moves: number, par: number): void {
    this.el.hudLevel.textContent = String(this.currentLevel);
    this.el.hudMoves.textContent = String(moves);
    this.el.hudPar.textContent = String(par);
    this.refreshBest();
  }

  private refreshBest(): void {
    const best = this.scores.best(this.currentLevel);
    this.el.hudBest.textContent = best ? String(best.bestMoves) : '—';
  }

  private showWin(moves: number, par: number, isBest: boolean): void {
    this.el.winMoves.textContent = String(moves);
    this.el.winPar.textContent = String(par);
    this.show(this.el.winBest, isBest);
    this.show(this.el.winBanner, true);
  }

  // ------------------------------------------------------------- test api ----
  /** A small, stable surface used by the functional (Playwright) tests. */
  private exposeTestApi(): void {
    (window as unknown as Record<string, unknown>).__COLORWATER = {
      getLevel: () => this.currentLevel,
      getMoves: () => this.engine?.moves ?? 0,
      getPar: () => this.generated?.par ?? 0,
      getPlayerName: () => this.player.name,
      isCompleted: () => this.engine?.completed ?? false,
      getState: () => this.engine?.currentState.snapshot(),
      tap: (id: number) => this.controller?.tap(id),
      move: (from: number, to: number) => this.engine?.applyMove({ from, to }) ?? null,
      undo: () => this.controller?.undo(),
      /** Drive the engine through the generated optimal-ish solution. */
      solve: () => {
        if (!this.engine || !this.generated) return false;
        for (const m of this.generated.solution) this.engine.applyMove(m);
        return this.engine.completed;
      },
    };
    window.dispatchEvent(new CustomEvent('colorwater:ready'));
  }

  // ------------------------------------------------------------- helpers -----
  private byId<T extends HTMLElement = HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing DOM element #${id}`);
    return el as T;
  }

  private show(el: HTMLElement, visible: boolean): void {
    el.classList.toggle('hidden', !visible);
  }
}

function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
