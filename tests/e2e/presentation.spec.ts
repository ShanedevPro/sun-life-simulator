import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
const authored = JSON.parse(await fs.readFile('story/full-game.json', 'utf8'));
const nodes = Object.fromEntries(authored.nodes.map((n: { id: string }) => [n.id, n]));
const legacy = JSON.parse(await fs.readFile('src/story/legacy-v2.json', 'utf8'));

const out = `${process.env.PLAYTEST_OUTPUT ?? 'docs/qa/full-game-20261024'}/presentation`;
const entry = process.env.PLAYTEST_URL ?? 'http://127.0.0.1:5173/';
const frame = (page: Page) => page.locator('.game-frame');
const sceneReady = (page: Page) => expect(frame(page)).toHaveAttribute('data-ready', 'true');
async function complete(page: Page) { await sceneReady(page); await expect(frame(page)).toHaveAttribute('data-reveal', 'complete'); }
async function openAt(page: Page, target: string) {
  let nodeId = authored.start;
  const trail = [nodeId], decisions: { nodeId: string; choiceId: string }[] = [];
  for (let i = 0; i < authored.nodes.length && nodeId !== target; i++) {
    const node = nodes[nodeId], choice = node.choices?.[0];
    if (choice) decisions.push({ nodeId, choiceId: choice.id });
    nodeId = choice?.to ?? node.next; trail.push(nodeId);
  }
  expect(nodeId).toBe(target);
  const progress = { nodeId, trail, decisions };
  const checkpoints = Object.fromEntries(trail.filter(id => nodes[id].decisionId).map(id => {
    const checkpointTrail = trail.slice(0, trail.indexOf(id) + 1);
    return [nodes[id].decisionId, { nodeId: id, trail: checkpointTrail, decisions: decisions.filter(decision => checkpointTrail.slice(0,-1).includes(decision.nodeId)) }];
  }));
  const save = { version: 4, progress, checkpoints, completed: [], chapterOutcomes: trail.filter(id => nodes[id].kind === 'chapter-end'), fontSize: 'standard', textDisplay: 'animated' };
  await page.addInitScript(s => {
    if (!localStorage.getItem('sunge.life.v4')) localStorage.setItem('sunge.life.v4', JSON.stringify(s));
  }, save);
  await page.goto(entry); await sceneReady(page);
  await page.getByRole('button', { name: '继续故事', exact: true }).click();
  await expect(frame(page)).toHaveAttribute('data-node', target); await sceneReady(page);
}
async function shot(page: Page, name: string) {
  await fs.mkdir(out, { recursive: true });
  if (!name.includes('text-in-progress')) {
    await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); });
    await page.waitForTimeout(150);
  }
  await page.screenshot({ path: `${out}/${name}.png` });
}
const shown = async (page: Page) => Number(await frame(page).getAttribute('data-text-visible'));

test('authored subtitles reveal in place before actions become available', async ({ page }) => {
  await openAt(page, 'H03');
  await expect(frame(page)).toHaveAttribute('data-reveal', 'revealing');
  const count = await shown(page), total = await page.locator('.reveal-text span').count();
  expect(count).toBeGreaterThan(0); expect(count).toBeLessThan(total);
  await expect(page.getByRole('button', { name: '把旧稿再寄一次', exact: true })).not.toBeVisible();
  await expect(page.locator('.actions')).toHaveAttribute('inert', '');
  const bounds = () => page.locator('.reveal-text span').evaluateAll(elements => elements.map(e => {
    const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height];
  }));
  const before = await bounds();
  const accessible = await page.locator('.narrative [aria-live]').textContent();
  await shot(page, '15-text-in-progress');
  await complete(page);
  expect(await bounds()).toEqual(before);
  expect(await page.locator('.narrative [aria-live]').textContent()).toBe(accessible);
  await expect(page.getByRole('button', { name: '把旧稿再寄一次', exact: true })).toBeVisible();
  await shot(page, '16-text-complete-action');
});

test('tapping a revealing choice completes text without choosing or skipping', async ({ page }) => {
  await openAt(page, 'H07');
  await expect(frame(page)).toHaveAttribute('data-reveal', 'revealing');
  await expect(page.getByRole('button', { name: '去上海参加复赛', exact: true })).not.toBeVisible();
  await page.mouse.dblclick(150, 250, { delay: 20 });
  await complete(page);
  await expect(frame(page)).toHaveAttribute('data-node', 'H07');
  await expect(page.getByRole('button', { name: '去上海参加复赛', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '留下准备高考', exact: true })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sunge.life.v4')!));
  expect(saved.progress.decisions).toEqual([]);
  await shot(page, '17-choice-after-reveal');
  await page.getByRole('button', { name: '留下准备高考', exact: true }).click();
  await expect(frame(page)).toHaveAttribute('data-node', 'H13');
});

test('pause freezes unfinished text and resume continues the same scene', async ({ page }) => {
  await openAt(page, 'H06');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const paused = await shown(page), total = await page.locator('.reveal-text span').count();
  expect(paused).toBeLessThan(total);
  await page.waitForTimeout(750);
  expect(await shown(page)).toBe(paused);
  await page.getByRole('button', { name: '继续故事', exact: true }).click();
  await complete(page);
  await expect(frame(page)).toHaveAttribute('data-node', 'H06');
  await expect(page.locator('.speaker')).toHaveText('老师');
  await shot(page, '18-teacher-after-resume');
});

test('keyboard reveal consumes one press and preserves a usable focus', async ({ page }) => {
  await openAt(page, 'H03');
  await page.getByRole('button', { name: '显示全部文字', exact: true }).focus();
  await page.keyboard.press('Enter');
  await complete(page);
  await expect(frame(page)).toHaveAttribute('data-node', 'H03');
  await expect(page.getByRole('button', { name: '把旧稿再寄一次', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(frame(page)).toHaveAttribute('data-node', 'H04');
  await complete(page);
  await expect(page.getByRole('button', { name: '继续', exact: true })).toBeFocused();
});

test('instant subtitle preference survives reload and reduced motion bypasses reveal', async ({ page }) => {
  await openAt(page, 'H03');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '直接', exact: true }).click();
  await shot(page, '19-subtitle-settings');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '继续故事', exact: true }).click();
  await complete(page);
  await page.reload(); await sceneReady(page);
  await page.getByRole('button', { name: '继续故事', exact: true }).click(); await sceneReady(page);
  await expect(frame(page)).toHaveAttribute('data-reveal', 'complete');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sunge.life.v4')!));
  expect(saved.textDisplay).toBe('instant');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '渐显', exact: true }).click();
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: '继续故事', exact: true }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '把旧稿再寄一次', exact: true }).click(); await sceneReady(page);
  await expect(frame(page)).toHaveAttribute('data-node', 'H04');
  await expect(frame(page)).toHaveAttribute('data-reveal', 'complete');
});

test('v2 browser save continues at the original dialogue with new shots and no data loss', async ({ page }) => {
  const graph = Object.fromEntries(legacy.nodes.map((n: { id: string }) => [n.id, n]));
  let id = 'P01'; const trail = [id];
  while (id !== 'H06') { id = graph[id].next!; trail.push(id); }
  const old = { version: 2, progress: { nodeId: id, trail, decisions: [] }, checkpoint: null, completed: ['U01'], fontSize: 'large' };
  await page.addInitScript(s => localStorage.setItem('sunge.high-school.v2', JSON.stringify(s)), old);
  await page.goto(entry); await sceneReady(page);
  await page.getByRole('button', { name: '继续故事', exact: true }).click(); await complete(page);
  await expect(frame(page)).toHaveAttribute('data-node', 'H06');
  await expect(page.locator('.speaker')).toHaveText('老师');
  await expect(frame(page)).toHaveClass(/large-text/);
  await page.getByRole('button', { name: '继续', exact: true }).click(); await complete(page);
  await expect(frame(page)).toHaveAttribute('data-node', 'H06B');
  const result = await page.evaluate(() => ({ old: JSON.parse(localStorage.getItem('sunge.high-school.v2')!), current: JSON.parse(localStorage.getItem('sunge.life.v4')!) }));
  expect(result.old).toEqual(old); expect(result.current.completed).toEqual([]);expect(result.current.chapterOutcomes).toEqual(['U01']);expect(result.current.version).toBe(4);
  expect(result.current.progress.trail).toContain('H06A');
  expect(result.current.progress.nodeId).toBe('H06B');
});

test('dialogue remains fully readable on small screens with large subtitles', async ({ page }) => {
  await openAt(page, 'H06'); await complete(page);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '大', exact: true }).click();
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: '继续故事', exact: true }).click();
  for (const size of [{ width: 320, height: 568 }, { width: 375, height: 667 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size);
    await expect.poll(() => page.locator('.narrative-scroll').evaluate(e => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
    await expect(page.getByRole('button', { name: '继续', exact: true })).toBeInViewport();
    const boxes = await page.evaluate(() => {
      const photo = document.querySelector('.photo-stage')!.getBoundingClientRect();
      const panel = document.querySelector('.story-panel')!.getBoundingClientRect();
      return { photoBottom: photo.bottom, photoRight: photo.right, panelTop: panel.top, panelLeft: panel.left };
    });
    if (size.width < 400) expect(boxes.photoBottom).toBeLessThanOrEqual(boxes.panelTop + 1);
    else expect(boxes.photoRight).toBeLessThanOrEqual(boxes.panelLeft + 1);
    await shot(page, `20-dialogue-${size.width}x${size.height}-large`);
  }
});

test('a simulated hidden-page event freezes the subtitle clock without catch-up', async ({ page }) => {
  await openAt(page, 'H03');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(50);
  const stopped = await shown(page), total = await page.locator('.reveal-text span').count();
  expect(stopped).toBeLessThan(total);
  await page.waitForTimeout(700); expect(await shown(page)).toBe(stopped);
  await page.evaluate(() => { Reflect.deleteProperty(document, 'hidden'); document.dispatchEvent(new Event('visibilitychange')); });
  await complete(page);
  await expect(frame(page)).toHaveAttribute('data-node', 'H03');
});
