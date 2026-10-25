import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
const out = `${process.env.PLAYTEST_OUTPUT ?? 'docs/qa/full-game-20261024'}/regression`;
const entry = process.env.PLAYTEST_URL ?? 'http://127.0.0.1:5173/';
test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }); });
const frame = (page: Page) => page.locator('.game-frame');
const ready = async (page: Page) => { await expect(frame(page)).toHaveAttribute('data-ready','true'); await expect(frame(page)).toHaveAttribute('data-reveal','complete'); };
async function start(page: Page) { await page.goto(entry);await ready(page);await page.getByRole('button',{name:'开始故事',exact:true}).click(); }
async function travel(page: Page,target:string,fork='去上海参加复赛') {
  for(let i=0;i<160;i++) {
    await ready(page);
    const id=await frame(page).getAttribute('data-node');
    if(id===target)return;
    const label=id==='H03'?'把旧稿再寄一次':id==='H07'?fork:'继续';
    await page.getByRole('button',{name:label,exact:true}).click();
  }
  throw new Error(`Did not reach ${target}`);
}
async function screenshot(page:Page,name:string){
  await expect.poll(()=>page.locator('canvas').evaluate(c=>{
    const ratio=Math.min(devicePixelRatio||1,2),box=c.parentElement!.getBoundingClientRect();
    return Math.abs(c.width-box.width*ratio)<=2 && Math.abs(c.height-box.height*ratio)<=2;
  })).toBe(true);
  await page.evaluate(async()=>{await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
  await page.waitForTimeout(150);
  await fs.mkdir(`${out}/screenshots`,{recursive:true});
  await page.screenshot({path:`${out}/screenshots/${name}.png`});
}
function trackErrors(page:Page){const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});return errors;}
async function largeText(page:Page){
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  await page.getByRole('button',{name:'设置',exact:true}).click();
  await page.getByRole('button',{name:'大',exact:true}).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'继续故事',exact:true}).click();
}

test('mobile high-school routes retain cinematic history, recaps and checkpoint replay',async({page})=>{
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors=trackErrors(page), requested:string[]=[];
  page.on('request',r=>{if(r.url().endsWith('.webp'))requested.push(r.url());});
  await page.goto(entry);await ready(page);await screenshot(page,'01-opening');
  expect(new Set(requested).size).toBeLessThanOrEqual(2);
  await page.getByRole('button',{name:'开始故事',exact:true}).click();
  await travel(page,'P03');await screenshot(page,'02-intertitle');
  await expect(page.locator('.intertitle h1')).toHaveText('再寄一次');
  await travel(page,'H01');await screenshot(page,'03-reading');
  await travel(page,'H06A');await screenshot(page,'03a-two-shot');
  await travel(page,'H06');await screenshot(page,'03b-teacher');
  await expect(page.locator('.speaker')).toHaveText('老师');
  await travel(page,'H06B');await screenshot(page,'03c-response');
  await expect(page.locator('.speaker')).toHaveText('你');
  await travel(page,'H07');await screenshot(page,'04-choice');
  await page.getByRole('button',{name:'暂停',exact:true}).click();await screenshot(page,'05-pause');
  await expect(page.getByRole('dialog')).toHaveClass(/pause-menu/);
  await expect(page.locator('.underlay .choice-button').first()).toBeHidden();
  await expect(frame(page)).toHaveAttribute('data-node','H07');
  await page.getByRole('button',{name:'剧情回看',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toContainText('你去了上海。');
  await expect.poll(()=>page.locator('.menu-body').evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  await expect(page.locator('.history-list li').last()).toBeInViewport();await screenshot(page,'06-history');
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveClass(/pause-menu/);
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'暂停',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'去上海参加复赛',exact:true}).click();
  await expect(page.locator('.choice-button.selected')).toContainText('去上海');
  await travel(page,'H10');await screenshot(page,'07-result');
  await travel(page,'H10B');await screenshot(page,'08-opportunity');
  await travel(page,'U01');await screenshot(page,'09-real-ending');
  // U01/B1_01 are chapter recaps in v4, not life-ending collection records.
  await expect(page.locator('.chapter-recap')).toBeVisible();
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  await page.getByRole('button',{name:'已走过的选择',exact:true}).click();await screenshot(page,'10-replay');
  await page.getByRole('button',{name:'回到：去上海，还是留下',exact:true}).click();await ready(page);
  await expect(frame(page)).toHaveAttribute('data-node','H07');
  await travel(page,'H13','留下准备高考');await screenshot(page,'11-stay');
  await travel(page,'B1_01','留下准备高考');await screenshot(page,'12-parallel-ending');
  await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('button',{name:'剧情回看',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toContainText('你去了上海。');
  await expect(page.getByRole('dialog')).toContainText('偶尔停笔，会想一想上海');
  expect(errors).toEqual([]);
});

test('fresh stay branch has aftermath and continues beyond its chapter recap',async({page})=>{
  await start(page);await travel(page,'H13B','留下准备高考');
  await expect(page.locator('.narrative')).toContainText('晚自习');
  await travel(page,'H13C');await expect(page.locator('.narrative')).toContainText('没去成的地方');
  await travel(page,'B1_01');
  await expect(page.locator('.chapter-recap')).toBeVisible();
  const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('sunge.life.v4')!));
  expect(save.progress.trail).not.toContain('H08');expect(save.completed).toEqual([]);expect(save.chapterOutcomes).toContain('B1_01');
  await page.getByRole('button',{name:'继续',exact:true}).click();await ready(page);
  await expect(frame(page)).toHaveAttribute('data-node','B1_02');
  await expect(page.locator('.scene-time')).toHaveText('2013 年');
});

test('refresh restores exact position, double clicks do not skip, restart keeps reached milestones',async({page})=>{
  await start(page);await ready(page);
  await page.getByRole('button',{name:'继续',exact:true}).dblclick({delay:30});
  await ready(page);await expect(frame(page)).toHaveAttribute('data-node','P02');
  await travel(page,'H07');await page.reload();await ready(page);
  await page.getByRole('button',{name:'继续故事',exact:true}).click();await ready(page);
  await expect(frame(page)).toHaveAttribute('data-node','H07');
  await travel(page,'U01');await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('button',{name:'回到片头',exact:true}).click();await ready(page);
  await page.getByRole('button',{name:'重新开始',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'重新开始',exact:true}).click();await ready(page);
  await expect(frame(page)).toHaveAttribute('data-node','P01');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('sunge.life.v4')!));
  expect(saved.chapterOutcomes).toContain('U01');expect(saved.completed).toEqual([]);expect(saved.checkpoints.K01).toBeTruthy();expect(saved.progress.trail).toEqual(['P01']);
});

test('short portrait, large text and landscape keep scene and choices separate',async({page})=>{
  await page.setViewportSize({width:375,height:667});await start(page);await travel(page,'H07');await largeText(page);
  for(const size of [{width:375,height:667},{width:320,height:568},{width:844,height:390},{width:1440,height:1000}]){
    await page.setViewportSize(size);await screenshot(page,`13-choice-${size.width}x${size.height}-large`);
    for(const name of ['去上海参加复赛','留下准备高考']){
      const box=await page.getByRole('button',{name,exact:true}).boundingBox();expect(box).toBeTruthy();
      expect(box!.height).toBeGreaterThanOrEqual(60);expect(box!.y+box!.height).toBeLessThanOrEqual(size.height);expect(box!.x).toBeGreaterThanOrEqual(0);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(size.width);
    expect(await page.locator('.narrative-scroll').evaluate(el=>el.scrollHeight<=el.clientHeight+1)).toBe(true);
    const rects=await page.evaluate(()=>{const photo=document.querySelector('.photo-stage')!.getBoundingClientRect(), text=document.querySelector('.story-panel')!.getBoundingClientRect();return {photoBottom:photo.bottom,photoRight:photo.right,textTop:text.top,textLeft:text.left};});
    if(size.width===320||size.width===375)expect(rects.photoBottom).toBeLessThanOrEqual(rects.textTop+1);
    if(size.width===844){const box=(await frame(page).boundingBox())!;expect(box.width/box.height).toBeCloseTo(9/16,2);}
  }
  await page.getByRole('button',{name:'留下准备高考',exact:true}).click();await ready(page);await expect(frame(page)).toHaveAttribute('data-node','H13');
});

test('keyboard focus survives narration, black card and the choice; modal input is isolated',async({page})=>{
  await start(page);await ready(page);
  await page.getByRole('button',{name:'继续',exact:true}).focus();await page.keyboard.press('Enter');await ready(page);
  await expect(frame(page)).toHaveAttribute('data-node','P02');await expect(page.getByRole('button',{name:'继续',exact:true})).toBeFocused();
  await page.keyboard.press('Enter');await ready(page);await expect(frame(page)).toHaveAttribute('data-node','P03');
  await expect(page.getByRole('button',{name:'继续',exact:true})).toBeFocused();
  await travel(page,'H06B');await page.getByRole('button',{name:'继续',exact:true}).focus();await page.keyboard.press('Enter');await ready(page);
  await expect(page.getByRole('button',{name:'去上海参加复赛',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'暂停',exact:true}).click();await expect(page.locator('.underlay')).toHaveAttribute('inert','');
  await page.getByRole('button',{name:'设置',exact:true}).click();await page.getByRole('button',{name:'关于这段人生',exact:true}).click();
  await page.keyboard.press('Escape');await expect(page.getByRole('heading',{name:'设置',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveClass(/pause-menu/);
  await page.keyboard.press('Escape');await expect(frame(page)).toHaveAttribute('data-node','H07');
});

test('DPR 3 is capped at 2 while keeping CSS layout unchanged',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3});
  const page=await context.newPage();await page.goto(entry);await ready(page);
  const metrics=await page.locator('canvas').evaluate(c=>({width:c.width,height:c.height,cssWidth:c.getBoundingClientRect().width,cssHeight:c.getBoundingClientRect().height}));
  expect(metrics).toEqual({width:780,height:1688,cssWidth:390,cssHeight:844});
  await screenshot(page,'14-dpr3-opening');await context.close();
});

test('invalid storage is recoverable',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('sunge.life.v4','{"version":999}'));
  await page.goto(entry);await ready(page);await expect(page.getByText('上次的进度暂时无法读取，可以重新开始。')).toBeVisible();
  await page.getByRole('button',{name:'开始故事',exact:true}).click();await ready(page);await expect(frame(page)).toHaveAttribute('data-node','P01');
});
test('storage write rejection never falsely reports saved',async({page})=>{
  await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new DOMException('denied','QuotaExceededError');};});
  await start(page);await ready(page);await expect(page.getByRole('status')).toContainText('存不下来');
  await page.getByRole('button',{name:'暂停',exact:true}).click();await expect(page.getByRole('dialog')).not.toContainText('进度已自动保存');
  await page.getByRole('button',{name:'继续故事',exact:true}).click();await page.getByRole('button',{name:'继续',exact:true}).click();await ready(page);await expect(frame(page)).toHaveAttribute('data-node','P02');
});
test('failed photo retries, reduced motion and navigation blocked while loading',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});let fail=true;
  await page.route('**/p_xining.webp',async route=>{if(fail)await route.abort();else await route.continue();});
  await start(page);await expect(page.getByRole('button',{name:'重新加载',exact:true})).toBeVisible();
  await expect(page.locator('.load-hint')).toBeHidden();
  await expect(frame(page)).toHaveAttribute('data-node','P01');
  await expect(page.locator('.actions .continue-button')).toBeDisabled();
  await expect(page.locator('.reveal-control')).toBeDisabled();
  fail=false;await page.getByRole('button',{name:'重新加载',exact:true}).click();await ready(page);
  await expect(page.locator('.narrative')).toContainText('1990 年 7 月 30 日');
  await travel(page,'P03');await expect(page.locator('.intertitle')).toBeVisible();
  await page.getByRole('button',{name:'继续',exact:true}).click();await ready(page);await expect(frame(page)).toHaveAttribute('data-node','H01');
});
test('late photo response cannot replace the opening after returning home during a load',async({page})=>{
  const errors=trackErrors(page);let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/p_huizhou.webp',async route=>{await gate;await route.continue().catch(()=>{});});
  await start(page);await ready(page);await page.getByRole('button',{name:'继续',exact:true}).click();
  await expect(frame(page)).toHaveAttribute('data-node','P02');await expect(frame(page)).toHaveAttribute('data-ready','false');
  await expect(page.locator('.load-hint')).toBeVisible();
  await page.getByRole('button',{name:'暂停',exact:true}).click();await page.getByRole('button',{name:'回到片头',exact:true}).click();await ready(page);
  await expect(page.locator('.load-hint')).toBeHidden();
  await page.waitForTimeout(1100);await expect(page.locator('.load-hint')).toBeHidden();
  await page.evaluate(async()=>{await Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{})));});
  const before=await page.screenshot();release();
  await page.waitForTimeout(400);expect(await page.screenshot()).toEqual(before);
  await expect(frame(page)).toHaveAttribute('data-node','opening');expect(errors).toEqual([]);
});
