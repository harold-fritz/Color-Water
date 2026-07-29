import { test, expect, type Page } from '@playwright/test';

/** Shape of the in-page test API exposed by App.exposeTestApi(). */
interface ColorWaterApi {
  getLevel(): number;
  getMoves(): number;
  getPar(): number;
  getPlayerName(): string;
  isCompleted(): boolean;
  getState(): { bottles: Array<{ id: number; isLarge: boolean; segments: string[]; capped: boolean }> };
  move(from: number, to: number): unknown;
  undo(): void;
  solve(): boolean;
}

declare global {
  interface Window {
    __COLORWATER: ColorWaterApi;
  }
}

async function startGame(page: Page, name = 'Walter'): Promise<void> {
  await page.goto('/');
  await page.getByTestId('start-button').click();
  await expect(page.getByTestId('name-screen')).toBeVisible();
  await page.getByTestId('name-input').fill(name);
  await page.getByTestId('name-submit').click();
  await expect(page.getByTestId('game-screen')).toBeVisible();
  await page.waitForFunction(() => Boolean(window.__COLORWATER?.getState()));
}

test.describe('Color Walter – start flow', () => {
  test('shows the title, description and a start button', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('start-screen')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Color/i })).toBeVisible();
    await expect(page.getByText(/Torres de Hanói/i)).toBeVisible();
    await expect(page.getByTestId('start-button')).toBeVisible();
  });

  test('Start leads to the name screen', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('start-button').click();
    await expect(page.getByTestId('name-screen')).toBeVisible();
    await expect(page.getByTestId('name-input')).toBeVisible();
  });

  test('requires a name before playing', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('start-button').click();
    await page.getByTestId('name-submit').click();
    await expect(page.getByTestId('name-error')).toBeVisible();
    await expect(page.getByTestId('game-screen')).toBeHidden();
  });

  test('entering a name starts level 1', async ({ page }) => {
    await startGame(page, 'Ada');
    await expect(page.getByTestId('hud-player')).toHaveText('Ada');
    await expect(page.getByTestId('hud-level')).toHaveText('1');
    await expect(page.getByTestId('hud-moves')).toHaveText('0');
    expect(await page.evaluate(() => window.__COLORWATER.getLevel())).toBe(1);
  });
});

test.describe('Color Walter – level 1 board', () => {
  test('has 2 immovable large bottles and 6 small bottles', async ({ page }) => {
    await startGame(page);
    const counts = await page.evaluate(() => {
      const bottles = window.__COLORWATER.getState().bottles;
      return {
        large: bottles.filter((b) => b.isLarge).length,
        small: bottles.filter((b) => !b.isLarge).length,
      };
    });
    expect(counts.large).toBe(2);
    expect(counts.small).toBe(6);
  });

  test('renders a Phaser canvas', async ({ page }) => {
    await startGame(page);
    await expect(page.locator('#game-canvas canvas')).toBeVisible();
  });
});

test.describe('Color Walter – gameplay', () => {
  test('a move increments the counter and undo reverts it', async ({ page }) => {
    await startGame(page);
    // Find any legal move from the current state and apply it.
    const moved = await page.evaluate(() => {
      const api = window.__COLORWATER;
      const bottles = api.getState().bottles;
      for (const from of bottles) {
        if (from.isLarge || from.segments.length === 0) continue;
        for (const to of bottles) {
          if (from.id === to.id) continue;
          const before = api.getMoves();
          api.move(from.id, to.id);
          if (api.getMoves() > before) return true;
        }
      }
      return false;
    });
    expect(moved).toBe(true);
    await expect(page.getByTestId('hud-moves')).toHaveText('1');

    await page.getByTestId('undo-button').click();
    await expect(page.getByTestId('hud-moves')).toHaveText('0');
  });

  test('solving the level shows the win banner and records the score', async ({ page }) => {
    await startGame(page);
    const completed = await page.evaluate(() => window.__COLORWATER.solve());
    expect(completed).toBe(true);

    await expect(page.getByTestId('win-banner')).toBeVisible();
    await expect(page.getByTestId('win-title')).toContainText('completado');

    const moves = await page.evaluate(() => window.__COLORWATER.getMoves());
    await expect(page.getByTestId('win-moves')).toHaveText(String(moves));
    await expect(page.getByTestId('hud-best')).not.toHaveText('—');
  });

  test('advancing to the next level updates the HUD', async ({ page }) => {
    await startGame(page);
    await page.evaluate(() => window.__COLORWATER.solve());
    await expect(page.getByTestId('win-banner')).toBeVisible();
    await page.getByTestId('next-button').click();
    await expect(page.getByTestId('hud-level')).toHaveText('2');
    await expect(page.getByTestId('hud-moves')).toHaveText('0');
    expect(await page.evaluate(() => window.__COLORWATER.getLevel())).toBe(2);
  });

  test('reset returns the move counter to zero', async ({ page }) => {
    await startGame(page);
    await page.evaluate(() => {
      const api = window.__COLORWATER;
      const bottles = api.getState().bottles;
      outer: for (const from of bottles) {
        if (from.isLarge || from.segments.length === 0) continue;
        for (const to of bottles) {
          if (from.id === to.id) continue;
          const before = api.getMoves();
          api.move(from.id, to.id);
          if (api.getMoves() > before) break outer;
        }
      }
    });
    await expect(page.getByTestId('hud-moves')).toHaveText('1');
    await page.getByTestId('reset-button').click();
    await expect(page.getByTestId('hud-moves')).toHaveText('0');
  });
});

test.describe('Color Walter – saved user', () => {
  test('a refresh resumes the saved name and level without asking again', async ({ page }) => {
    await startGame(page, 'Helena');
    // Advance a level so we have progress to resume.
    await page.evaluate(() => window.__COLORWATER.solve());
    await page.getByTestId('next-button').click();
    await expect(page.getByTestId('hud-level')).toHaveText('2');

    await page.reload();
    // No start/name screen — straight back into the game at level 2.
    await expect(page.getByTestId('game-screen')).toBeVisible();
    await expect(page.getByTestId('name-screen')).toBeHidden();
    await page.waitForFunction(() => Boolean(window.__COLORWATER?.getState()));
    await expect(page.getByTestId('hud-player')).toHaveText('Helena');
    await expect(page.getByTestId('hud-level')).toHaveText('2');
    expect(await page.evaluate(() => window.__COLORWATER.getLevel())).toBe(2);
  });

  test('"Nuevo usuario" clears the saved player and returns to the name prompt', async ({ page }) => {
    await startGame(page, 'Helena');
    await page.evaluate(() => window.__COLORWATER.solve());
    await page.getByTestId('next-button').click();
    await expect(page.getByTestId('hud-level')).toHaveText('2');

    page.on('dialog', (d) => d.accept());
    await page.getByTestId('new-user-button').click();
    await expect(page.getByTestId('name-screen')).toBeVisible();

    // Play as someone else — they start fresh at level 1.
    await page.getByTestId('name-input').fill('Marco');
    await page.getByTestId('name-submit').click();
    await expect(page.getByTestId('game-screen')).toBeVisible();
    await page.waitForFunction(() => Boolean(window.__COLORWATER?.getState()));
    await expect(page.getByTestId('hud-player')).toHaveText('Marco');
    await expect(page.getByTestId('hud-level')).toHaveText('1');

    // And the switch persists across a refresh.
    await page.reload();
    await page.waitForFunction(() => Boolean(window.__COLORWATER?.getState()));
    await expect(page.getByTestId('hud-player')).toHaveText('Marco');
    await expect(page.getByTestId('hud-level')).toHaveText('1');
  });
});
