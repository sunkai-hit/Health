import { test, expect } from '@playwright/test';

const label = prefix => prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 1_000_000);
async function boot(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/demo');
  await expect(page.locator('#active-persona')).toContainText('虚构用户 A');
  return errors;
}
async function createEvent(page, title) {
  await page.locator('#title').fill(title);
  await page.locator('#create').click();
  await expect(page.locator('#events')).toContainText(title);
  await expect(page.locator('#timeline')).toContainText(title);
}
async function choose(page, persona, display) {
  await page.locator('#persona').selectOption(persona);
  await expect(page.locator('#active-persona')).toContainText(display);
  await expect(page.locator('#log')).not.toContainText('身份切换失败');
}

test('local demo page loads with a synthetic session but does not persist credentials', async ({ page }) => {
  const errors=await boot(page);
  const result=await page.evaluate(() => ({
    localKeys:Object.keys(localStorage),
    sessionKeys:Object.keys(sessionStorage),
    cookie:document.cookie
  }));
  expect(result.localKeys).toEqual([]);
  expect(result.sessionKeys).toEqual([]);
  expect(result.cookie).toBe('');
  const tokenless=await page.evaluate(async ()=>{
    const r=await fetch('/api/v1/events');
    return r.status;
  });
  expect(tokenless).toBe(401);
  expect(errors).toEqual([]);
});

test('A and B stay isolated after switching and returning to the first account', async ({ page }) => {
  await boot(page);
  const titleA=label('虚构-A-页面');
  const titleB=label('虚构-B-页面');
  await createEvent(page,titleA);
  await choose(page,'bob','虚构用户 B');
  await expect(page.locator('#events')).not.toContainText(titleA);
  await createEvent(page,titleB);
  await choose(page,'alice','虚构用户 A');
  await expect(page.locator('#events')).toContainText(titleA);
  await expect(page.locator('#events')).not.toContainText(titleB);
  await choose(page,'bob','虚构用户 B');
  await expect(page.locator('#events')).toContainText(titleB);
  await expect(page.locator('#events')).not.toContainText(titleA);
});

test('symptoms and selected body region stay with the correct synthetic identity', async ({ page }) => {
  await boot(page);
  const title=label('虚构-A-症状');
  const symptom=label('虚构-腹部记录');
  await createEvent(page,title);
  await page.locator('#symptoms').fill('虚构胀痛');
  await page.locator('#view').selectOption('front');
  await page.locator('#zone').selectOption('upper-abd');
  await page.locator('#severity').selectOption('3');
  await page.locator('#description').fill(symptom);
  await page.locator('#record').click();
  await expect(page.locator('#timeline')).toContainText(symptom);
  await expect(page.locator('#timeline')).toContainText('front:upper-abd');
  await choose(page,'bob','虚构用户 B');
  await expect(page.locator('#timeline')).not.toContainText(symptom);
  await choose(page,'alice','虚构用户 A');
  await expect(page.locator('#timeline')).toContainText(symptom);
});

test('refresh gets a new in-memory local demo session without losing encrypted D1 records', async ({ page }) => {
  await boot(page);
  const title=label('虚构-A-刷新');
  await createEvent(page,title);
  await page.reload();
  await expect(page.locator('#active-persona')).toContainText('虚构用户 A');
  await expect(page.locator('#events')).toContainText(title);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test('HTML-like synthetic event title is displayed as inert text', async ({ page }) => {
  await boot(page);
  const text=label('<img src=x onerror=alert(99)>');
  await createEvent(page,text);
  await expect(page.locator('#events')).toContainText(text);
  await expect(page.locator('#events img')).toHaveCount(0);
});

test('rapid account switching must not revive a stale earlier session response', async ({ page }) => {
  await page.route('**/api/v1/dev/session', async route => {
    const payload=route.request().postDataJSON();
    if(payload.persona==='alice')await new Promise(resolve => setTimeout(resolve,700));
    await route.continue();
  });
  await page.goto('/demo');
  await page.locator('#persona').selectOption('bob');
  await expect(page.locator('#active-persona')).toContainText('虚构用户 B');
  await page.waitForTimeout(950);
  await expect(page.locator('#active-persona')).toContainText('虚构用户 B');
  expect(await page.locator('#persona').inputValue()).toBe('bob');
});
