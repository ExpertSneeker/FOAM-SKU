import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js';

const storageKey = 'foam-sku:config:v2';
const screenshots = path.join(tmpdir(), 'foam-sku-module-order-20261024');
const modules = [
  { id: 'base', unit: 'cm', length: 80, width: 60, thickness: 10, count: 2 },
  { id: 'middle', unit: 'cm', length: 50, width: 40, thickness: 6, count: 1 },
  { id: 'top', unit: 'cm', length: 30, width: 20, thickness: 3, count: 1 },
];
const readConfig = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
const card = (page, id) => page.locator(`.module-card[data-module-id="${id}"]`);
const order = page => page.locator('.module-list > .module-card').evaluateAll(cards => cards.map(card => card.dataset.moduleId));

async function openStack(page) {
  const config = normalizeConfig({ ...DEFAULT_CONFIG, modules, stackAlignment: 'back-right', radius: 18.2, exportWidth: 1024, exportHeight: 1024, samples: 16 });
  await page.addInitScript(({ key, config }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(config));
  }, { key: storageKey, config });
  await page.goto('/');
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  await expect.poll(() => readConfig(page)).toEqual(config);
  return config;
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error; });
});

test('module cards show top first and collapse independently without changing configuration or rendered foam', async ({ page }) => {
  const config = await openStack(page);
  await expect.poll(() => page.getByRole('group', { name: /^海绵模块/ }).evaluateAll(cards => cards.map(card => card.getAttribute('aria-label')))).toEqual(['海绵模块 3', '海绵模块 2', '海绵模块 1']);
  await expect.poll(() => order(page)).toEqual(['top', 'middle', 'base']);
  await expect(card(page, 'top')).toContainText('顶层');
  await expect(card(page, 'base')).toContainText('底层');
  await expect(card(page, 'top').getByRole('button', { name: '往上放', exact: true })).toBeDisabled();
  await expect(card(page, 'base').getByRole('button', { name: '往下放', exact: true })).toBeDisabled();
  const rendered = await page.getByTestId('preview').evaluate(canvas => canvas.toDataURL());
  const middle = card(page, 'middle');
  await middle.getByRole('button', { name: '折叠模块 2', exact: true }).click();
  const toggle = middle.getByRole('button', { name: '展开模块 2', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator(`#${await toggle.getAttribute('aria-controls')}`)).toBeHidden();
  await expect(middle.getByLabel('长度', { exact: true })).toBeHidden();
  await expect(middle).toContainText('50 × 40 × 6 cm · 1 片');
  await expect(middle.getByRole('button', { name: '往上放', exact: true })).toBeVisible();
  await expect(card(page, 'base').getByLabel('长度', { exact: true })).toBeVisible();
  expect(await readConfig(page)).toEqual(config);
  expect(await page.getByTestId('preview').evaluate(canvas => canvas.toDataURL())).toBe(rendered);
  await toggle.click();
  await expect(middle.getByLabel('长度', { exact: true })).toHaveValue('50');
  await card(page, 'base').getByRole('button', { name: '折叠模块 1', exact: true }).click();
  await middle.getByRole('button', { name: '折叠模块 2', exact: true }).click();
  await card(page, 'top').scrollIntoViewIfNeeded();
  await fs.mkdir(screenshots, { recursive: true });
  await page.screenshot({ path: path.join(screenshots, 'desktop.png') });
});

test('moving folded modules follows physical directions and retains identity, collapse state and saved order', async ({ page }) => {
  await openStack(page);
  const middle = card(page, 'middle');
  await middle.getByRole('button', { name: '折叠模块 2', exact: true }).click();
  await middle.getByRole('button', { name: '往上放', exact: true }).click();
  await expect.poll(() => order(page)).toEqual(['middle', 'top', 'base']);
  await expect(middle.getByRole('button', { name: '展开模块 3', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect(middle.getByLabel('长度', { exact: true })).toBeHidden();
  await expect.poll(async () => (await readConfig(page)).modules.map(module => module.id)).toEqual(['base', 'top', 'middle']);
  await middle.getByRole('button', { name: '往下放', exact: true }).click();
  await expect.poll(() => order(page)).toEqual(['top', 'middle', 'base']);
  await expect(middle.getByRole('button', { name: '展开模块 2', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await expect.poll(async () => (await readConfig(page)).modules.map(module => module.id)).toEqual(['base', 'middle', 'top']);
  const savedEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存参数', exact: true }).click();
  const saved = JSON.parse(await fs.readFile(await (await savedEvent).path(), 'utf8'));
  expect(saved.modules).toEqual(modules);
  await page.reload();
  await expect.poll(() => order(page)).toEqual(['top', 'middle', 'base']);
});

test('new modules appear expanded at the top and folded modules can be deleted without opening', async ({ page }) => {
  await openStack(page);
  await card(page, 'top').getByRole('button', { name: '折叠模块 3', exact: true }).click();
  await page.getByRole('button', { name: '添加海绵模块', exact: true }).click();
  const first = page.locator('.module-list > .module-card').first();
  await expect(first.getByRole('button', { name: '折叠模块 4', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(first.getByLabel('长度', { exact: true })).toHaveValue('30');
  await expect(first.getByLabel('片数', { exact: true })).toHaveValue('1');
  await expect(first.getByRole('button', { name: '折叠模块 4', exact: true })).toBeInViewport();
  const id = await first.getAttribute('data-module-id');
  await expect.poll(() => order(page)).toEqual([id, 'top', 'middle', 'base']);
  await expect(card(page, 'top').getByRole('button', { name: '展开模块 3', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await card(page, 'top').getByRole('button', { name: '删除模块', exact: true }).click();
  await expect.poll(() => order(page)).toEqual([id, 'middle', 'base']);
  await expect.poll(async () => (await readConfig(page)).modules.map(module => module.id)).toEqual(['base', 'middle', id]);
});

test('module disclosure supports keyboard and compact mobile layouts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openStack(page);
  const middle = card(page, 'middle');
  await middle.getByRole('button', { name: '折叠模块 2', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(middle.getByLabel('长度', { exact: true })).toBeHidden();
  await page.keyboard.press('Space');
  await expect(middle.getByLabel('长度', { exact: true })).toBeVisible();
  for (const [id, number] of [['top', 3], ['middle', 2], ['base', 1]]) {
    await card(page, id).getByRole('button', { name: `折叠模块 ${number}`, exact: true }).click();
  }
  await expect.poll(() => order(page)).toEqual(['top', 'middle', 'base']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await fs.mkdir(screenshots, { recursive: true });
  await page.screenshot({ path: path.join(screenshots, 'mobile.png'), fullPage: true });
});

test('adding a module keeps its title and actions inside the inspector in a short desktop window', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 580 });
  await openStack(page);
  await page.getByRole('button', { name: '添加海绵模块', exact: true }).click();
  const toggle = page.locator('.module-list > .module-card').first().getByRole('button', { name: '折叠模块 4', exact: true });
  await expect.poll(() => toggle.evaluate(button => {
    const viewport = button.closest('.inspector-scroll').getBoundingClientRect();
    const header = button.closest('.module-header').getBoundingClientRect();
    return header.top >= viewport.top && header.bottom <= viewport.bottom;
  })).toBe(true);
  await toggle.click();
  await expect(page.locator('.module-list > .module-card').first().getByLabel('长度', { exact: true })).toBeHidden();
});
