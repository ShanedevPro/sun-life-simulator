import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';

const out = 'docs/qa/full-game-20261024/loading';
const entry = process.env.PLAYTEST_URL ?? 'http://127.0.0.1:5173/';
const frame = (page: Page) => page.locator('.game-frame');
async function complete(page: Page) {
  await expect(frame(page)).toHaveAttribute('data-ready', 'true');
  await expect(frame(page)).toHaveAttribute('data-reveal', 'complete');
}
async function shot(page: Page, name: string) {
  await fs.mkdir(out, { recursive: true });
  await page.screenshot({ path: `${out}/${name}.png` });
}

test('normal photo changes, shared photos and black cards never flash loading feedback', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(entry); await complete(page);
  await page.evaluate(() => {
    const state = window as typeof window & { loadFlashes: string[] };
    state.loadFlashes = [];
    const sample = () => {
      document.querySelectorAll('.load-hint, .load-state').forEach(element => {
        const css = getComputedStyle(element);
        if (css.visibility !== 'hidden' && Number(css.opacity) > 0.01) state.loadFlashes.push(element.textContent ?? '');
      });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.getByRole('button', { name: '开始人生', exact: true }).click();
  for (const id of ['P01', 'P02', 'P03', 'H01', 'H02', 'H03']) {
    await complete(page);
    await expect(frame(page)).toHaveAttribute('data-node', id);
    if (id !== 'H03') await page.getByRole('button', { name: '继续', exact: true }).click();
  }
  expect(await page.evaluate(() => (window as typeof window & { loadFlashes: string[] }).loadFlashes)).toEqual([]);
  await expect(page.getByText('正在准备这一幕', { exact: true })).toHaveCount(0);
  await shot(page, '01-normal-scene');
  expect(errors).toEqual([]);
});

test('a slow photo preserves the previous frame and delays the hint, text and controls', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/p_huizhou.webp', async route => { await gate; await route.continue(); });
  await page.goto(entry); await complete(page);
  await page.getByRole('button', { name: '开始人生', exact: true }).click(); await complete(page);
  const bounds = (await page.locator('canvas').boundingBox())!;
  // Element screenshots also contain overlapping DOM. Compare the photo area,
  // excluding the date and subtitles that intentionally disappear at the cut.
  const clip = { x: bounds.x, y: bounds.y + bounds.height * .15, width: bounds.width, height: bounds.height * .45 };
  const previous = await page.screenshot({ clip });
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await expect(frame(page)).toHaveAttribute('data-node', 'P02');
  await page.waitForTimeout(350);
  await expect(page.locator('.load-hint')).toBeHidden();
  await expect(frame(page)).toHaveAttribute('data-ready', 'false');
  await expect(frame(page)).toHaveAttribute('data-text-visible', '0');
  await expect(page.locator('.scene-time')).toBeHidden();
  await expect(page.locator('.reveal-control')).toBeDisabled();
  const waiting = await page.screenshot({ clip });
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(`${out}/photo-before.png`, previous);
  await fs.writeFile(`${out}/photo-waiting.png`, waiting);
  expect(waiting.equals(previous), 'The previous photo remains on the canvas while downloading').toBe(true);
  await shot(page, '02-quiet-wait');
  await expect(page.locator('.load-hint')).toBeVisible();
  await expect(page.locator('.load-hint')).toHaveCSS('opacity', '1');
  await expect(page.locator('.load-hint')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.getByRole('status')).toHaveText('载入中');
  await shot(page, '03-slow-hint');
  await page.locator('.photo-advance').dispatchEvent('click');
  await expect(frame(page)).toHaveAttribute('data-node', 'P02');
  release();
  await complete(page);
  await expect(page.locator('.load-hint')).toBeHidden();
  await expect(page.locator('.scene-time')).toBeVisible();
  expect((await page.screenshot({ clip })).equals(previous)).toBe(false);
  await shot(page, '04-resumed-scene');
});

test('a slow opening uses the same discreet hint and enables start only after the photo', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/h_manuscript.webp', async route => { await gate; await route.continue(); });
  await page.goto(entry);
  await expect(page.locator('.load-hint')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('载入中');
  await expect(frame(page)).toHaveAttribute('data-ready', 'false');
  await expect(page.locator('.opening-panel .primary-button')).toBeDisabled();
  await shot(page, '05-opening-wait');
  release(); await complete(page);
  await expect(page.locator('.load-hint')).toBeHidden();
  await expect(page.getByRole('button', { name: '开始人生', exact: true })).toBeEnabled();
});
