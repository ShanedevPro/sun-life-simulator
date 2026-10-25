import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';

const content = JSON.parse(await fs.readFile('story/full-game.json', 'utf8'));
type Choice = { id: string; label: string; to: string; route?: string };
type Node = { id: string; kind: string; next?: string; choices?: Choice[]; actionLabel?: string; decisionId?: string; endingId?: string; sources?: string[] };
const graph: Record<string, Node> = Object.fromEntries(content.nodes.map((node: Node) => [node.id, node]));
const frame = (page: Page) => page.locator('.game-frame');
const site = process.env.PLAYTEST_URL ?? 'http://127.0.0.1:5173/';
const saveKey = 'sunge.life.v4';
const out = process.env.PLAYTEST_OUTPUT ?? 'docs/qa/full-ui-20261024';
async function ready(page: Page) {
  await expect(frame(page)).toHaveAttribute('data-ready', 'true');
  await expect(frame(page)).toHaveAttribute('data-reveal', 'complete');
  const cache = await page.locator('canvas').evaluate(canvas => ({ photos: Number(canvas.dataset.photoCache), requests: Number(canvas.dataset.photoRequests) }));
  expect(cache.photos).toBeLessThanOrEqual(6);
  expect(cache.requests).toBeLessThanOrEqual(2);
}
async function shot(page: Page, name: string) {
  await page.evaluate(async () => { await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {}))); });
  await page.locator('img').evaluateAll(async images => {
    await Promise.all(images.filter(image => {
      const bounds = image.getBoundingClientRect();
      return bounds.bottom > 0 && bounds.top < innerHeight && bounds.right > 0 && bounds.left < innerWidth;
    }).map(image => image.decode().catch(() => {})));
  });
  await fs.mkdir(out, { recursive: true });
  await page.screenshot({ path: `${out}/${name}.png` });
}
async function step(page: Page, alternative = false) {
  await ready(page);
  const id = (await frame(page).getAttribute('data-node'))!, node = graph[id];
  if (node.kind === 'ending') return;
  const choice = node.choices?.find(value => alternative ? value.route?.startsWith('parallel') : value.route === 'historical') ?? node.choices?.[alternative ? 1 : 0];
  await page.getByRole('button', { name: choice?.label ?? node.actionLabel ?? '继续', exact: true }).click();
  await expect(frame(page)).not.toHaveAttribute('data-node', id);
}
async function walkToEnd(page: Page) {
  for (let i = 0; i < content.nodes.length; i++) {
    await ready(page);
    const node = graph[(await frame(page).getAttribute('data-node'))!];
    if (node.kind === 'ending') return node.endingId;
    await step(page);
  }
  throw new Error('Story did not reach an ending');
}
function pathTo(target: string, nodeId: string = content.start, trail: string[] = []): string[] | null {
  if (trail.includes(nodeId)) return null;
  const path = [...trail, nodeId];
  if (target === nodeId) return path;
  const node = graph[nodeId];
  for (const next of node?.choices?.map(choice => choice.to) ?? (node?.next ? [node.next] : [])) {
    const found = pathTo(target, next, path);
    if (found) return found;
  }
  return null;
}
async function seedAt(page: Page, target: string, large = false) {
  const path = pathTo(target);
  if (!path) throw new Error(`Unreachable scene: ${target}`);
  const decisions: { nodeId: string; choiceId: string }[] = [];
  const checkpoints: Record<string, { nodeId: string; trail: string[]; decisions: typeof decisions }> = {};
  path.forEach((id, index) => {
    const node = graph[id];
    if (node.decisionId) checkpoints[node.decisionId] = { nodeId: id, trail: path.slice(0, index + 1), decisions: structuredClone(decisions) };
    const choice = node.choices?.find(value => value.to === path[index + 1]);
    if (choice) decisions.push({ nodeId: id, choiceId: choice.id });
  });
  const ending = graph[target].endingId;
  const save = { version: 4, progress: { nodeId: target, trail: path, decisions }, checkpoints, completed: ending ? [ending] : [], chapterOutcomes: path.filter(id => graph[id].kind === 'chapter-end'), fontSize: large ? 'large' : 'standard', textDisplay: 'instant' };
  await page.addInitScript(({ key, value }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value)); }, { key: saveKey, value: save });
  await page.goto(site); await ready(page);
  const continueButton = page.getByRole('button', { name: '继续故事', exact: true });
  await expect(continueButton).toBeVisible();
  await continueButton.click(); await ready(page);
}

test('complete historical life and all seven alternatives through reached-choice replay', async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(site); await ready(page);
  await page.getByRole('button', { name: '开始故事', exact: true }).click();
  expect(await walkToEnd(page)).toBe('R0');
  await expect(page.locator('.ending-title')).toHaveText(content.endings.R0.title);
  await expect(page.locator('.ending-panel')).toBeVisible();
  await expect(page.locator('.game-frame')).not.toHaveClass(/black-state/);
  await shot(page, '01-historical-ending');
  for (let index = 7; index >= 1; index--) {
    const decision = content.decisions[`K0${index}`];
    await page.getByRole('button', { name: '换个选择', exact: true }).click();
    await expect(page.locator('.replay-item')).toHaveCount(7);
    await page.getByRole('button', { name: `回到：${decision.title}`, exact: true }).click();
    await expect(frame(page)).toHaveAttribute('data-node', decision.nodeId);
    await step(page, true);
    expect(await walkToEnd(page)).toBe(`B${index}`);
    await expect(page.locator('.ending-title')).toHaveText(content.endings[`B${index}`].title);
    await shot(page, `02-ending-B${index}`);
  }
  await page.getByRole('button', { name: '走过的人生', exact: true }).click();
  await expect(page.locator('.collected-ending')).toHaveCount(8);
  await expect(page.locator('.unseen-ending')).toHaveCount(0);
  await expect(page.locator('.collection-count')).toHaveText('已走过 8 / 8');
  await shot(page, '03-all-lives');
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), saveKey);
  expect(stored.completed.sort()).toEqual(Object.keys(content.endings).sort());
  expect(Object.keys(stored.checkpoints)).toHaveLength(7);
  expect(errors).toEqual([]);
});

test('new players see no future ending names or decision titles', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(site); await ready(page);
  await shot(page, '00-opening');
  await page.getByRole('button', { name: '走过的人生', exact: true }).click();
  await expect(page.locator('.unseen-ending')).toHaveCount(8);
  await expect(page.locator('.collected-ending')).toHaveCount(0);
  for (const ending of Object.values(content.endings) as { title: string }[]) await expect(page.getByRole('dialog')).not.toContainText(ending.title);
  await shot(page, '04-unseen-lives');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '开始故事', exact: true }).click(); await ready(page);
  await shot(page, '00-birth');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await expect(page.getByRole('button', { name: '已走过的选择', exact: true })).toHaveCount(0);
  for (const decision of Object.values(content.decisions) as { title: string }[]) await expect(page.getByRole('dialog')).not.toContainText(decision.title);
});

test('chapter handoff continues and early replay shows only the reached decision', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedAt(page, 'U01');
  await expect(page.locator('.chapter-recap')).toBeVisible();
  await expect(page.locator('.chapter-recap')).not.toContainText('待续');
  await step(page); await ready(page);
  await expect(frame(page)).toHaveAttribute('data-node', graph.U01.next!);
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.getByRole('button', { name: '已走过的选择', exact: true }).click();
  await expect(page.locator('.replay-item')).toHaveCount(1);
  for (let i = 2; i <= 7; i++) await expect(page.getByRole('dialog')).not.toContainText(content.decisions[`K0${i}`].title);
  await shot(page, '05-first-replay');
});

test('photo endings keep text and controls usable on small phones and landscape', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedAt(page, content.endings.B1.nodeId, true);
  for (const size of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 375, height: 667 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size); await ready(page);
    await expect(page.getByRole('button', { name: '换个选择', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: '走过的人生', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: '回到片头', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(size.width);
    const rects = await page.evaluate(() => {
      const photo = document.querySelector('.photo-stage')!.getBoundingClientRect(), panel = document.querySelector('.ending-panel')!.getBoundingClientRect();
      return { photoBottom: photo.bottom, photoRight: photo.right, panelTop: panel.top, panelLeft: panel.left };
    });
    if (size.height <= 700 && size.width < size.height) expect(rects.photoBottom).toBeLessThanOrEqual(rects.panelTop + 1);
    if (size.width > size.height) {
      const box = (await frame(page).boundingBox())!;
      expect(box.width / box.height).toBeCloseTo(9 / 16, 2);
    }
    await shot(page, `06-ending-${size.width}x${size.height}`);
  }
});

test('source menu includes only sources attached to reached scenes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedAt(page, 'H07');
  await page.getByRole('button', { name: '暂停', exact: true }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '关于这段人生', exact: true }).click();
  await page.getByRole('button', { name: '查看已读情节的来源', exact: true }).click();
  const path = pathTo('H07')!;
  const reached = [...new Set(path.flatMap(id => graph[id].sources ?? []))].filter(id => content.sources[id]);
  await expect(page.locator('.source-list a')).toHaveCount(reached.length);
  for (const id of reached) await expect(page.locator('.source-list')).toContainText(content.sources[id].title);
  await shot(page, '07-reached-sources');
});

for (const target of ['H07', 'U02']) {
  test(`draft scene ${target} keeps large subtitles and controls clear at phone sizes`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedAt(page, target, true);
    for (const size of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 375, height: 667 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(size); await ready(page);
      await expect(page.locator('.story-panel')).toBeVisible();
      await expect(page.locator('.scene-time')).toBeVisible();
      await expect.poll(() => page.locator('.narrative-scroll').evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
      const actions = page.locator('.actions button');
      for (const button of await actions.all()) {
        await expect(button).toBeInViewport();
        const box = (await button.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      const bounds = await page.evaluate(() => {
        const photo = document.querySelector('.photo-stage')!.getBoundingClientRect(), panel = document.querySelector('.story-panel')!.getBoundingClientRect();
        return { photoBottom: photo.bottom, photoRight: photo.right, panelTop: panel.top, panelLeft: panel.left };
      });
      if (size.height <= 700 && size.width < size.height) expect(bounds.photoBottom).toBeLessThanOrEqual(bounds.panelTop + 1);
      if (size.width > size.height) {
        const box = (await frame(page).boundingBox())!;
        expect(box.width / box.height).toBeCloseTo(9 / 16, 2);
      }
      await shot(page, `08-${target}-${size.width}x${size.height}-large`);
    }
    await page.setViewportSize({ width: 320, height: 568 });
    await page.getByRole('button', { name: '暂停', exact: true }).click();
    await expect(page.locator('.underlay')).toHaveAttribute('inert', '');
    await expect(page.getByRole('dialog')).toBeVisible();
    if (target === 'H07') await expect(page.getByRole('button', { name: '去上海参加复赛', exact: true })).toHaveCount(0);
    await shot(page, `09-${target}-pause-small`);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: '暂停', exact: true })).toBeFocused();
    await expect(frame(page)).toHaveAttribute('data-node', target);
  });
}

test('all choice scenes stay readable with large text on the shortest phone', async ({ browser }) => {
  test.setTimeout(90000);
  const choiceScenes = (content.nodes as Node[]).filter(node => node.choices).map(node => ({ id: node.decisionId ?? node.id, nodeId: node.id }));
  for (const decision of choiceScenes) {
    const context = await browser.newContext({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await seedAt(page, decision.nodeId, true);
    for (const size of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(size); await ready(page);
      const textBounds = await page.locator('.narrative-scroll').evaluate(element => {
        const clip = element.getBoundingClientRect();
        const characters = [...element.querySelectorAll('.reveal-text span')].map(character => character.getBoundingClientRect());
        return { top: clip.top, bottom: clip.bottom, firstGlyph: Math.min(...characters.map(character => character.top)), lastGlyph: Math.max(...characters.map(character => character.bottom)) };
      });
      // Paragraph margins may overflow by a few pixels without clipping text.
      expect(textBounds.firstGlyph, `${decision.id}: first line`).toBeGreaterThanOrEqual(textBounds.top - 1);
      expect(textBounds.lastGlyph, `${decision.id}: last line`).toBeLessThanOrEqual(textBounds.bottom + 1);
      for (const button of await page.locator('.choice-button').all()) {
        await expect(button).toBeInViewport();
        const box = (await button.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(60);
      }
      await shot(page, `10-${decision.id}-${size.width}x${size.height}-large`);
    }
    await context.close();
  }
});

test('long black narration uses reading text and keeps continuation visible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedAt(page, 'F07', true);
  const scene = content.nodes.find((node: Node) => node.id === 'F07');
  for (const size of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(size); await ready(page);
    await expect(page.locator('.narration-card')).toBeVisible();
    await expect(page.locator('.intertitle h1')).toHaveCount(0);
    await expect(page.locator('.intertitle .eyebrow')).toHaveText(scene.time);
    await expect(page.locator('.intertitle-subtitle')).toHaveText(scene.text);
    const paragraphs = page.locator('.intertitle-subtitle');
    for (const paragraph of await paragraphs.all()) {
      expect(await paragraph.evaluate(element => getComputedStyle(element).fontSize)).toBe('24px');
    }
    await expect(page.getByRole('button', { name: '继续', exact: true })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(size.width);
    await shot(page, `12-F07-${size.width}x${size.height}-large`);
  }
  await step(page); await ready(page);
  await expect(frame(page)).toHaveAttribute('data-node', graph.F07.next!);
});

test('desktop windows retain a centered portrait frame and contain their controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedAt(page, 'P01', true);
  for (const size of [{width:943,height:421}, {width:844,height:390}, {width:500,height:400}, {width:1280,height:600}, {width:953,height:700}, {width:1440,height:900}, {width:1920,height:1080}]) {
    await page.setViewportSize(size); await ready(page);
    const box = (await frame(page).boundingBox())!;
    expect(box.width / box.height).toBeCloseTo(9 / 16, 2);
    expect(box.x + box.width / 2).toBeCloseTo(size.width / 2, 0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height);
    const elements = page.locator('.photo-stage, .game-header, .story-panel, .scene-time, .pause-button, .actions button');
    for (const element of await elements.all()) {
      const rect = (await element.boundingBox())!;
      expect(rect.x).toBeGreaterThanOrEqual(box.x - 1);
      expect(rect.x + rect.width).toBeLessThanOrEqual(box.x + box.width + 1);
    }
    const photo = (await page.locator('.photo-stage').boundingBox())!;
    expect(photo.width).toBeCloseTo(box.width, 0);
    await expect(page.getByRole('button', {name:'继续', exact:true})).toBeInViewport();
    expect(await page.locator('.narrative-scroll').evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    await shot(page, `13-desktop-${size.width}x${size.height}`);
    await page.getByRole('button', {name:'暂停', exact:true}).click();
    const menu = (await page.getByRole('dialog').boundingBox())!;
    expect(menu.width).toBeCloseTo(box.width, 0);
    expect(menu.height).toBeCloseTo(box.height, 0);
    expect(menu.x).toBeCloseTo(box.x, 0);
    await expect(page.getByRole('button', {name:'继续故事', exact:true})).toBeInViewport();
    await shot(page, `14-desktop-pause-${size.width}x${size.height}`);
    await page.keyboard.press('Escape');
    await expect(frame(page)).toHaveAttribute('data-node','P01');
  }
  await page.setViewportSize({width:943,height:421});
  await page.getByRole('button', {name:'暂停', exact:true}).click();
  await page.getByRole('button', {name:'回到片头', exact:true}).click(); await ready(page);
  await expect(page.getByRole('button', {name:'继续故事', exact:true})).toBeInViewport();
  const opening = (await page.locator('.opening-panel').boundingBox())!;
  expect(opening.y).toBeGreaterThanOrEqual((await frame(page).boundingBox())!.y + 40);
  await shot(page, '14-desktop-opening-943x421');
});

test('a sideways touch phone retains the readable split layout and rotates back to portrait', async ({ browser }) => {
  const context = await browser.newContext({ viewport:{width:844,height:390}, isMobile:true, hasTouch:true, reducedMotion:'reduce' });
  try {
    const page = await context.newPage();
    await seedAt(page, 'C08', true);
    expect(await page.evaluate(() => matchMedia('(hover: none) and (pointer: coarse)').matches)).toBe(true);
    const photo = (await page.locator('.photo-stage').boundingBox())!;
    const panel = (await page.locator('.story-panel').boundingBox())!;
    expect(photo.x + photo.width).toBeLessThanOrEqual(panel.x + 1);
    for (const button of await page.locator('.choice-button').all()) {
      await expect(button).toBeInViewport();
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(60);
    }
    await shot(page, '15-touch-landscape');
    await page.setViewportSize({width:390,height:844}); await ready(page);
    expect((await frame(page).boundingBox())!.width).toBe(390);
    expect((await frame(page).boundingBox())!.height).toBe(844);
    await expect(frame(page)).toHaveAttribute('data-node','C08');
    await shot(page, '16-touch-portrait');
  } finally { await context.close(); }
});
