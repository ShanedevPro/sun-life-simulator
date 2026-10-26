import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';

const site = process.env.PLAYTEST_URL ?? 'http://127.0.0.1:5173/';
const out = `${process.env.PLAYTEST_OUTPUT ?? 'docs/qa/homepage-20261025'}/homepage`;
const frame = (page: Page) => page.locator('.game-frame');
async function ready(page: Page) {
  await expect(frame(page)).toHaveAttribute('data-ready', 'true');
  await expect(frame(page)).toHaveAttribute('data-reveal', 'complete');
  await page.evaluate(() => document.fonts.ready);
}
async function shot(page: Page, name: string) {
  await fs.mkdir(out, { recursive: true });
  await page.screenshot({ path: `${out}/${name}.png` });
}

test('the title screen starts, resumes, explains the adaptation and links to GitHub', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(site); await ready(page);
  await expect(page).toHaveTitle('孙哥的模拟人生');
  await expect(page.getByRole('heading', { name: '孙哥的模拟人生' })).toBeVisible();
  expect(await page.evaluate(() => document.fonts.check('24px "Sunge Title"', '孙哥模拟人生'))).toBe(true);
  await expect(page.getByText('一段可以重新选择的人生', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '重新开始', exact: true })).toHaveCount(0);
  const github = page.getByRole('link', { name: /GitHub/ });
  await expect(github).toHaveAttribute('href', 'https://github.com/ShanedevPro/sun-life-simulator');
  await expect(github).toHaveAttribute('target', '_blank');
  await expect(github).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(page.locator('link[rel="preload"][as="image"]')).toHaveAttribute('href', /title-lives\.webp$/);
  await shot(page, '01-new-player');
  await page.getByRole('button', { name: '关于', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('场景照片为重构，人物对白经过改编');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '关于', exact: true })).toBeFocused();
  await page.getByRole('button', { name: '开始故事', exact: true }).click();
  await expect(frame(page)).toHaveAttribute('data-node', 'P01'); await ready(page);
  const saved = await page.evaluate(() => localStorage.getItem('sunge.life.v4'));
  await page.reload(); await ready(page);
  await expect(page.getByRole('button', { name: '开始故事', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '重新开始', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('sunge.life.v4'))).toBe(saved);
  await shot(page, '02-returning-player');
  await page.getByRole('button', { name: '继续故事', exact: true }).click(); await ready(page);
  await expect(frame(page)).toHaveAttribute('data-node', 'P01');
  expect(errors).toEqual([]);
});

test('the cover title and real controls fit portrait phones and short desktop windows', async ({ page, browser }) => {
  await page.goto(site); await ready(page);
  await page.getByRole('button', { name: '开始故事', exact: true }).click(); await ready(page);
  await page.reload(); await ready(page);
  for (const size of [{ width: 393, height: 698 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 943, height: 421 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size); await ready(page);
    const bounds = (await frame(page).boundingBox())!;
    const title = (await page.locator('.opening-title').boundingBox())!;
    const menu = (await page.locator('.opening-panel').boundingBox())!;
    expect(title.y + title.height).toBeLessThan(menu.y);
    for (const element of await page.locator('.opening-title, .opening-panel button, .opening-footer button, .opening-footer a').all()) {
      const box = (await element.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(bounds.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
      expect(box.y).toBeGreaterThanOrEqual(bounds.y);
      expect(box.y + box.height).toBeLessThanOrEqual(bounds.y + bounds.height);
      if (await element.evaluate(el => el.matches('button, a'))) expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.locator('.title-name')).toHaveText('模拟人生');
    await shot(page, `03-cover-${size.width}x${size.height}`);
  }
  const touch = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  try {
    const phone = await touch.newPage();
    await phone.goto(site); await ready(phone);
    const title = (await phone.locator('.opening-title').boundingBox())!;
    const menu = (await phone.locator('.opening-panel').boundingBox())!;
    expect(title.y + title.height).toBeLessThan(menu.y);
    await expect(phone.getByRole('button', { name: '开始故事', exact: true })).toBeInViewport();
    await expect(phone.getByRole('link', { name: /GitHub/ })).toBeInViewport();
    await shot(phone, '04-touch-landscape');
    await phone.setViewportSize({ width: 390, height: 844 }); await ready(phone);
    expect((await frame(phone).boundingBox())!.width).toBe(390);
    await expect(phone.getByRole('heading', { name: '孙哥的模拟人生' })).toBeVisible();
    await shot(phone, '05-touch-portrait');
  } finally { await touch.close(); }
});
