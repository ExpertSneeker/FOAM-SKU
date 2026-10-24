import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js';

const screenshots = path.join(tmpdir(), 'foam-sku-resets-20261024');
const storageKey = 'foam-sku:config:v2';
const readConfig = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);

async function openConfig(page, patch) {
  const config = normalizeConfig({ ...DEFAULT_CONFIG, ...patch });
  await page.addInitScript(({ key, config }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(config));
  }, { key: storageKey, config });
  await page.goto('/');
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  await expect.poll(() => readConfig(page)).toEqual(config);
  return config;
}

async function reset(page, scope, label, fieldPath, value) {
  const expected = structuredClone(await readConfig(page));
  let target = expected;
  for (const key of fieldPath.slice(0, -1)) target = target[key];
  target[fieldPath.at(-1)] = value;
  await scope.getByRole('button', { name: `${label}恢复默认`, exact: true }).click();
  await expect.poll(() => readConfig(page)).toEqual(expected);
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error; });
});

test('individual product and module resets preserve other parameters, units, identity and order', async ({ page }) => {
  await openConfig(page, {
    modules: [
      { id: 'base', unit: 'cm', length: 80, width: 55, thickness: 8, count: 3 },
      { id: 'top', unit: 'cm', length: 40, width: 30, thickness: 5, count: 1 },
    ],
    stackAlignment: 'front-left', radius: 2, poreStrength: 0.5, poreScale: 1.2,
    foamColor: '#fff480', roughness: 0.8, edgeShade: 0.02,
  });
  const first = page.getByRole('group', { name: '海绵模块 1', exact: true });
  for (const [label, key, value] of [['长度', 'length', 60.96], ['宽度', 'width', 60.96], ['单片厚度', 'thickness', 10.16], ['片数', 'count', 2]]) {
    await reset(page, first, label, ['modules', 0, key], value);
  }
  await expect(first.getByLabel('长度', { exact: true })).toHaveValue('60.96');
  await reset(page, first, '单位', ['modules', 0, 'unit'], 'in');
  await expect(first.getByLabel('长度', { exact: true })).toHaveValue('24');
  await reset(page, page, '堆叠对齐', ['stackAlignment'], 'center');
  for (const [label, key, value] of [
    ['圆角半径', 'radius', 0.7], ['细孔强度', 'poreStrength', 0], ['细孔大小', 'poreScale', 0.3], ['表面颜色', 'foamColor', '#ffffff'],
  ]) await reset(page, page, label, [key], value);
  await page.getByText('更多材质设置', { exact: true }).click();
  await reset(page, page, '表面粗糙度', ['roughness'], 0.98);
  await reset(page, page, '上缘深浅', ['edgeShade'], 0.008);
  const second = page.getByRole('group', { name: '海绵模块 2', exact: true });
  const before = await readConfig(page);
  await second.getByRole('button', { name: '预设尺寸恢复默认', exact: true }).click();
  await expect.poll(() => readConfig(page)).toEqual({ ...before, modules: [before.modules[0], { ...before.modules[1], length: 60.96, width: 60.96, thickness: 10.16, count: 2 }] });
  await page.reload();
  await expect(first.getByLabel('长度', { exact: true })).toHaveValue('24');
  await expect(second.getByRole('button', { name: 'cm', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('camera and scene resets change only their own settings including inactive shadow and background values', async ({ page }) => {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await openConfig(page, {
    azimuth: -45, elevation: 30, focalLength: 85, framing: 0.6,
    transparent: false, background: '#e6dfd4', shadow: false, shadowOpacity: 0.3, shadowSoftness: 2,
    lighting: 0.8, topLight: 0.6,
  });
  await page.getByRole('tab', { name: '视角', exact: true }).click();
  for (const [label, key, value] of [['仰角', 'elevation', 11], ['方位角', 'azimuth', 31], ['镜头焦距', 'focalLength', 65], ['画面占比', 'framing', 0.84]]) {
    await reset(page, page, label, [key], value);
  }
  await page.getByRole('tab', { name: '场景', exact: true }).click();
  await reset(page, page, '透明背景', ['transparent'], true);
  await expect(page.getByLabel('背景颜色', { exact: true })).toBeDisabled();
  await reset(page, page, '背景颜色', ['background'], '#ffffff');
  await reset(page, page, '阴影浓度', ['shadowOpacity'], 0.11);
  await reset(page, page, '阴影柔和度', ['shadowSoftness'], 1.3);
  await expect(page.getByRole('switch', { name: '地面阴影', exact: true })).not.toBeChecked();
  await reset(page, page, '地面阴影', ['shadow'], true);
  await reset(page, page, '整体亮度', ['lighting'], 1.02);
  await reset(page, page, '顶部补光', ['topLight'], 0.32);
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await fs.mkdir(screenshots, { recursive: true });
  await page.screenshot({ path: path.join(screenshots, 'scene-desktop.png') });
  expect(errors).toEqual([]);
});

test('sheet resets retain stack settings and physical units and respect short-sheet geometry limits', async ({ page }) => {
  await openConfig(page, {
    shape: 'partial', stackAlignment: 'back-right',
    sheet: { unit: 'cm', length: 300, width: 80, thickness: 1.5 },
    rollInnerDiameter: 20, rollTailLength: 60, rollSide: 'right', rollRotation: 90,
  });
  for (const [label, key, value] of [['展开总长度', 'length', 254], ['卷宽', 'width', 60.96], ['厚度', 'thickness', 2.54], ['单片单位', 'unit', 'in']]) {
    await reset(page, page, label, ['sheet', key], value);
  }
  for (const [label, key, value] of [['卷芯内径', 'rollInnerDiameter', 10.16], ['平铺伸出长度', 'rollTailLength', 45.72], ['伸出方向', 'rollSide', 'left'], ['整体朝向', 'rollRotation', 0]]) {
    await reset(page, page, label, [key], value);
  }
  await expect(page.getByLabel('展开总长度', { exact: true })).toHaveValue('100');
  await reset(page, page, '海绵形态', ['shape'], 'stack');
  await expect(page.getByRole('button', { name: '右后对齐', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '半卷平铺', exact: true }).click();
  await page.getByLabel('展开总长度', { exact: true }).fill('4');
  await page.getByLabel('展开总长度', { exact: true }).blur();
  await page.getByRole('button', { name: '平铺伸出长度恢复默认', exact: true }).click();
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  await expect.poll(async () => {
    const c = await readConfig(page);
    return c.sheet.length === 10.16 && Number.isFinite(c.rollTailLength) && c.rollTailLength < c.sheet.length;
  }).toBe(true);
});

test('export fields reset independently and all resets are disabled during an export', async ({ page }) => {
  await openConfig(page, { transparent: false, format: 'jpeg', exportWidth: 768, exportHeight: 512, samples: 16 });
  await reset(page, page, '导出宽度', ['exportWidth'], 2000);
  await reset(page, page, '导出高度', ['exportHeight'], 2000);
  await reset(page, page, '导出格式', ['format'], 'png');
  await reset(page, page, '渲染质量', ['samples'], 64);
  await page.getByLabel('导出宽度', { exact: true }).fill('800');
  await page.getByLabel('导出宽度', { exact: true }).blur();
  await page.getByLabel('导出高度', { exact: true }).fill('600');
  await page.getByLabel('导出高度', { exact: true }).blur();
  await expect.poll(async () => (await readConfig(page)).exportHeight).toBe(600);
  const before = await readConfig(page);
  await page.getByRole('button', { name: '分辨率恢复默认', exact: true }).click();
  await expect.poll(() => readConfig(page)).toEqual({ ...before, exportWidth: 2000, exportHeight: 2000 });
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  await page.getByRole('button', { name: '导出 PNG', exact: true }).click();
  await expect(page.getByRole('button', { name: '海绵形态恢复默认', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '导出宽度恢复默认', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '取消导出', exact: true }).click();
  await expect(page.getByRole('button', { name: '海绵形态恢复默认', exact: true })).toBeEnabled();
});

test('reset icons remain accessible on mobile and resetting a typed number clears the draft', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openConfig(page, { radius: 2 });
  await page.getByLabel('圆角半径数值', { exact: true }).fill('4');
  await page.getByRole('button', { name: '圆角半径恢复默认', exact: true }).click();
  await expect(page.getByLabel('圆角半径数值', { exact: true })).toHaveValue('0.7');
  await page.getByLabel('圆角半径数值', { exact: true }).fill('5');
  await page.getByRole('button', { name: '圆角半径恢复默认', exact: true }).click();
  await expect(page.getByLabel('圆角半径数值', { exact: true })).toHaveValue('0.7');
  await page.getByRole('button', { name: '单位恢复默认', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'in', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: '导出宽度恢复默认', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  await fs.mkdir(screenshots, { recursive: true });
  await page.screenshot({ path: path.join(screenshots, 'product-mobile.png'), fullPage: true });
});
