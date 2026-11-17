import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const prototypeUrl = pathToFileURL(resolve('prototype/v0.1/index.html')).href;

async function nav(page, key) {
  const desktop = page.locator('#desktop-nav [data-nav="' + key + '"]');
  if (await desktop.isVisible()) {
    await desktop.click();
  } else if (['home', 'record', 'events', 'ai', 'report'].includes(key)) {
    await page.locator('.mobile-nav [data-nav="' + key + '"]').click();
  } else {
    await page.locator('.mobile-nav [data-nav="events"]').click();
    await page.locator('#event-detail [data-nav="' + key + '"]').click();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto(prototypeUrl);
});

test('initial demo page contains no runtime exceptions and no persistent storage', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.reload();
  await expect(page.locator('#stat-events')).toHaveText('1');
  await expect(page.locator('#stat-symptoms')).toHaveText('2');
  await expect(page.locator('#stat-medication')).toHaveText('2');
  expect(errors).toEqual([]);
  const state = await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }));
  expect(state).toEqual({ local: 0, session: 0 });
});

test('body map supports secondary region and new symptom event', async ({ page }) => {
  await nav(page, 'record');
  await page.locator('#body-svg [data-zone="front:upper-abd"]').click();
  await expect(page.locator('#zone-detail')).toContainText('上腹部');
  await page.locator('#zone-detail [data-zone-detail="2"]').click();
  await expect(page.locator('#selected-areas')).toContainText('右上腹');
  await page.locator('#symptom-chips [data-symptom="胀痛"]').click();
  await expect(page.locator('#severity-unknown')).toBeChecked();
  await page.locator('#symptom-notes').fill('演示不适过程');
  page.once('dialog', dialog => dialog.accept('测试健康事件'));
  await page.locator('#save-symptom').click();
  await expect(page.locator('#event-detail')).toContainText('测试健康事件');
  await expect(page.locator('#event-detail')).toContainText('右上腹');
});

test('multi-item prescription supports add, preserve draft and save', async ({ page }) => {
  await nav(page, 'care');
  await page.locator('[data-care-tab="order"]').click();
  await page.locator('#order-text').fill('虚构处方：供原型验收');
  await page.locator('#rx-items .rx-name').first().fill('虚构药品 A');
  await page.locator('#add-rx-item').click();
  await expect(page.locator('#rx-items .rx-item')).toHaveCount(2);
  await expect(page.locator('#rx-items .rx-name').first()).toHaveValue('虚构药品 A');
  await page.locator('#rx-items .rx-name').last().fill('虚构药品 B');
  await page.locator('#save-order').click();
  await expect(page.locator('#care-list')).toContainText('虚构处方：供原型验收');
  await expect(page.locator('#order-comparison')).toContainText('虚构药品 A');
  await expect(page.locator('#order-comparison')).toContainText('虚构药品 B');
});

test('an actual medication use can link to a specific prescription item', async ({ page }) => {
  await nav(page, 'medication');
  await page.locator('#med-name').fill('虚构药品乙');
  await page.locator('#med-dose').fill('1');
  await page.locator('#med-order').selectOption('demo-o-new');
  await expect(page.locator('#med-item-block')).toBeVisible();
  await page.locator('#med-item').selectOption('demo-p2');
  await page.locator('#save-med').click();
  await nav(page, 'report');
  await page.locator('#report-mode').selectOption('followup');
  await expect(page.locator('#report-content')).toContainText('对应处方药品：虚构药品乙');
});

test('follow-up plan is not completed until a separate visit is recorded', async ({ page }) => {
  await nav(page, 'care');
  await expect(page.locator('#followup-overview')).toContainText('已关联实际就诊 0 次');
  await page.locator('#visit-followup').selectOption('demo-o1');
  await page.locator('#visit-hospital').fill('虚构复诊机构');
  await page.locator('#save-visit').click();
  await expect(page.locator('#followup-overview')).toContainText('已关联实际就诊 1 次');
  await nav(page, 'report');
  await page.locator('#report-mode').selectOption('followup');
  await expect(page.locator('#report-content')).toContainText('虚构复诊机构');
});

test('order replacement preserves prior instruction in timeline', async ({ page }) => {
  await nav(page, 'care');
  await page.locator('[data-care-tab="order"]').click();
  await page.locator('#order-text').fill('虚构新版本的变更说明');
  await page.locator('#order-supersedes').selectOption('demo-o-new');
  await page.locator('#rx-items .rx-name').first().fill('虚构药品甲');
  await page.locator('#save-order').click();
  await expect(page.locator('#care-list')).toContainText('虚构新版本的变更说明');
  await expect(page.locator('#care-list')).toContainText('虚构处方的新版本');
  await expect(page.locator('#order-comparison')).toContainText('已有后续替代版本');
});

test('photo preview uses local object URL, is not OCR and resets on reload', async ({ page }) => {
  await nav(page, 'care');
  await page.locator('[data-care-tab="order"]').click();
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==','base64');
  await page.locator('#order-photo').setInputFiles({ name: 'fictional.png', mimeType: 'image/png', buffer: pixel });
  await expect(page.locator('#order-photo-preview')).toContainText('不上传');
  await expect(page.locator('#order-photo-preview img')).toBeVisible();
  await page.reload();
  await expect(page.locator('#order-photo')).toHaveValue('');
});

test('user text is escaped and is not interpreted as markup', async ({ page }) => {
  await nav(page, 'care');
  await page.locator('#visit-note').fill('<img src=x onerror=alert(1)>');
  await page.locator('#save-visit').click();
  await expect(page.locator('#care-list')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#care-list img')).toHaveCount(0);
});

test('mobile and desktop do not overflow viewport at initial home screen', async ({ page }) => {
  const dims = await page.evaluate(() => ({
    screenWidth: window.innerWidth,
    contentWidth: document.documentElement.scrollWidth
  }));
  expect(dims.contentWidth).toBeLessThanOrEqual(dims.screenWidth + 2);
});
