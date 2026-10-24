import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { DEFAULT_CONFIG, DEFAULT_MODULE, normalizeConfig } from '../src/config.js';
import { measureRoundingChange } from './helpers/rounding-profile.js';

const alignmentScreenshots = path.join(tmpdir(), 'foam-sku-alignment-20261024');

async function applyConfig(page, patch) {
  await page.getByLabel('导入参数文件', { exact: true }).setInputFiles({ name: 'foam-sku-config.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...DEFAULT_CONFIG, ...patch })) });
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
}

async function downloadImage(page, name = 'PNG') {
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: `导出 ${name}`, exact: true }).click();
  const download = await event;
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  return download.path();
}

test.beforeAll(async () => { await fs.mkdir('.local/qa', { recursive: true }); });

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { throw error; });
});

test('studio renders a low-angle aligned stack and exports real alpha at custom dimensions', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: '导出 PNG', exact: true })).toBeEnabled();
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  await page.getByRole('tab', { name: '视角', exact: true }).click();
  await expect(page.getByLabel('仰角数值', { exact: true })).toHaveValue('11');
  await page.getByRole('tab', { name: '场景', exact: true }).click();
  await page.getByRole('switch', { name: '透明背景', exact: true }).check();
  await page.getByRole('switch', { name: '地面阴影', exact: true }).uncheck();
  await page.getByLabel('导出宽度', { exact: true }).fill('768');
  await page.getByLabel('导出宽度', { exact: true }).blur();
  await page.getByLabel('导出高度', { exact: true }).fill('512');
  await page.getByLabel('导出高度', { exact: true }).blur();
  await page.getByLabel('渲染质量', { exact: true }).selectOption('16');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 PNG', exact: true }).click();
  const download = await downloadEvent;
  const path = await download.path();
  const metadata = await sharp(path).metadata();
  expect(metadata.width).toBe(768); expect(metadata.height).toBe(512); expect(metadata.hasAlpha).toBe(true);
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(data[3]).toBe(0);
  const center = (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * 4;
  expect(data[center + 3]).toBe(255);
  expect(data[center]).toBeGreaterThan(160);
  expect(errors).toEqual([]);
});

test('default desktop studio and exported white foam retain soft tonal separation', async ({ page }) => {
  await fs.mkdir('.local/qa', { recursive: true });
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto('/');
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  await page.getByRole('tab', { name: '场景', exact: true }).click();
  await expect(page.getByRole('switch', { name: '透明背景', exact: true })).toBeChecked();
  await page.screenshot({ path: '.local/qa/studio-desktop.png' });
  const path = await downloadImage(page);
  await fs.copyFile(path, '.local/qa/foam-default.png');
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  expect(info.width).toBe(2000); expect(info.height).toBe(2000);
  expect(data[3]).toBe(0);
  let nearWhite = 0, graySide = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] === 255 && data[i] > 238 && data[i] < 253) nearWhite++;
    if (data[i + 3] === 255 && data[i] > 170 && data[i] < 230) graySide++;
  }
  expect(nearWhite).toBeGreaterThan(10000); expect(graySide).toBeGreaterThan(10000);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('solid background and JPEG honor the chosen RGB and custom output size', async ({ page }) => {
  await page.goto('/');
  await applyConfig(page, { transparent: false, background: '#e6dfd4', exportWidth: 960, exportHeight: 640, samples: 16, format: 'jpeg' });
  const path = await downloadImage(page, 'JPEG');
  const metadata = await sharp(path).metadata();
  expect(metadata.format).toBe('jpeg'); expect(metadata.width).toBe(960); expect(metadata.height).toBe(640);
  const { data } = await sharp(path).raw().toBuffer({ resolveWithObject: true });
  [230, 223, 212].forEach((value, i) => expect(Math.abs(data[i] - value)).toBeLessThanOrEqual(2));
});

test('transparent ground shadow adds translucent pixels without baking the checkerboard', async ({ page }) => {
  await page.goto('/');
  await applyConfig(page, { transparent: true, exportWidth: 768, exportHeight: 768, samples: 32, shadow: false });
  const off = await sharp(await downloadImage(page)).ensureAlpha().raw().toBuffer();
  await page.getByRole('tab', { name: '场景', exact: true }).click();
  await page.getByRole('switch', { name: '地面阴影', exact: true }).check();
  const onPath = await downloadImage(page);
  const on = await sharp(onPath).ensureAlpha().raw().toBuffer();
  let shadowPixels = 0;
  for (let i = 3; i < on.length; i += 4) if (off[i] === 0 && on[i] > 0 && on[i] < 255) shadowPixels++;
  expect(shadowPixels).toBeGreaterThan(250);
  expect(on[3]).toBe(0);
  await fs.copyFile(onPath, '.local/qa/foam-alpha.png');
});

test('unit switching, JSON round trip, invalid file feedback and persistence', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  await page.getByRole('button', { name: 'cm', exact: true }).click();
  await expect(page.getByLabel('长度', { exact: true })).toHaveValue('60.96');
  await page.getByLabel('长度', { exact: true }).fill('80');
  await page.getByLabel('长度', { exact: true }).blur();
  await page.getByRole('button', { name: '增加片数' }).click();
  const savedEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存参数' }).click();
  const saved = JSON.parse(await fs.readFile(await (await savedEvent).path(), 'utf8'));
  expect(saved.modules[0].length).toBe(80); expect(saved.modules[0].count).toBe(3);
  await page.getByRole('button', { name: '恢复默认', exact: true }).click();
  await page.getByLabel('导入参数文件', { exact: true }).setInputFiles({ name: 'config.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(saved)) });
  await expect(page.getByLabel('长度', { exact: true })).toHaveValue('80');
  await expect(page.getByLabel('片数', { exact: true })).toHaveValue('3');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('foam-sku:config:v2'))?.modules[0].length === 80);
  await page.reload();
  await expect(page.getByLabel('长度', { exact: true })).toHaveValue('80');
  await page.getByLabel('导入参数文件', { exact: true }).setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"version":99}') });
  await expect(page.getByRole('alert')).toContainText('不是支持的');
  await expect(page.getByLabel('长度', { exact: true })).toHaveValue('80');
});

test('camera interaction and cancellation recover to a usable preview', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  const canvas = page.getByTestId('preview');
  await canvas.focus(); await page.keyboard.press('ArrowUp');
  await page.getByRole('tab', { name: '视角', exact: true }).click();
  await expect(page.getByLabel('仰角数值', { exact: true })).toHaveValue('14');
  await page.getByRole('button', { name: '复位视角', exact: true }).click();
  await expect(page.getByLabel('仰角数值', { exact: true })).toHaveValue('11');
  await page.getByLabel('渲染质量', { exact: true }).selectOption('64');
  await expect(canvas).toHaveAttribute('data-status', 'ready');
  await page.getByRole('button', { name: '导出 PNG', exact: true }).click();
  await page.getByRole('button', { name: '取消导出', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('已取消');
  await expect(canvas).toHaveAttribute('data-status', 'ready');
  await expect(page.getByRole('button', { name: '导出 PNG', exact: true })).toBeEnabled();
});

test('mobile layout has no horizontal overflow and all control groups work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/qa/studio-mobile.png', fullPage: true });
  await page.getByRole('tab', { name: '场景', exact: true }).click();
  await page.getByRole('switch', { name: '透明背景', exact: true }).check();
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  await expect(page.getByLabel('背景颜色', { exact: true })).toBeDisabled();
});

test('4096 px export completes with real product pixels', async ({ page }) => {
  await page.goto('/');
  await applyConfig(page, { transparent: true, shadow: false, exportWidth: 4096, exportHeight: 4096, samples: 16 });
  const path = await downloadImage(page);
  const metadata = await sharp(path).metadata();
  expect(metadata.width).toBe(4096); expect(metadata.height).toBe(4096);
  const center = await sharp(path).extract({ left: 2048, top: 2048, width: 1, height: 1 }).ensureAlpha().raw().toBuffer();
  expect(center[3]).toBe(255); expect(center[0]).toBeGreaterThan(160);
});

test('modules can have independent sizes, reorder, persist, export and be removed', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  const first = page.getByRole('group', { name: '海绵模块 1', exact: true });
  await expect(first.getByRole('button', { name: '删除模块' })).toBeDisabled();
  await page.getByRole('button', { name: '添加海绵模块', exact: true }).click();
  const second = page.getByRole('group', { name: '海绵模块 2', exact: true });
  await expect(second.getByLabel('片数', { exact: true })).toHaveValue('1');
  await second.getByRole('button', { name: 'cm', exact: true }).click();
  for (const [label, value] of [['长度', '40'], ['宽度', '30'], ['单片厚度', '5']]) {
    await second.getByLabel(label, { exact: true }).fill(value);
    await second.getByLabel(label, { exact: true }).blur();
  }
  await expect(first.getByLabel('长度', { exact: true })).toHaveValue('24');
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  await second.getByRole('button', { name: '往下放', exact: true }).click();
  await expect(first.getByLabel('长度', { exact: true })).toHaveValue('40');
  await expect(second.getByLabel('长度', { exact: true })).toHaveValue('24');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('foam-sku:config:v2'))?.modules[0].length === 40);
  await page.reload();
  await expect(first.getByLabel('长度', { exact: true })).toHaveValue('40');
  await page.getByLabel('导出宽度', { exact: true }).fill('768'); await page.getByLabel('导出宽度', { exact: true }).blur();
  await page.getByLabel('导出高度', { exact: true }).fill('512'); await page.getByLabel('导出高度', { exact: true }).blur();
  await page.getByLabel('渲染质量', { exact: true }).selectOption('16');
  const path = await downloadImage(page);
  const metadata = await sharp(path).metadata();
  expect(metadata.width).toBe(768); expect(metadata.height).toBe(512);
  await second.getByRole('button', { name: '删除模块' }).click();
  await expect(page.getByRole('group', { name: /^海绵模块/ })).toHaveCount(1);
  await page.getByRole('button', { name: '恢复默认', exact: true }).click();
  await expect(first.getByLabel('长度', { exact: true })).toHaveValue('24');
  await expect(page.getByLabel('圆角半径数值', { exact: true })).toHaveValue('0.7');
  await expect(page.getByLabel('细孔强度数值', { exact: true })).toHaveValue('0');
});

test('radius changes round interior slab contacts in real exports at different resolutions', async ({ page }) => {
  await page.goto('/');
  for (const size of [1024, 2000]) {
    const config = normalizeConfig({ modules: [{ ...DEFAULT_MODULE, count: 4 }], transparent: false, radius: 0, exportWidth: size, exportHeight: size, samples: 32 });
    await applyConfig(page, config);
    const flat = await downloadImage(page);
    const rounded = { ...config, radius: 18.2 };
    await applyConfig(page, rounded);
    const metrics = await measureRoundingChange(flat, await downloadImage(page), rounded);
    for (const contact of metrics) expect(contact.meanChange, `${size}px ${contact.face} contact ${contact.seam}`).toBeGreaterThan(2);
  }
  const examples = path.join(tmpdir(), 'foam-sku-rounding-20261024');
  await fs.mkdir(examples, { recursive: true });
  await applyConfig(page, { radius: 18.2, transparent: false, samples: 32 });
  await fs.copyFile(await downloadImage(page), path.join(examples, 'two-pieces-18.2mm.png'));
  await page.getByLabel('圆角半径', { exact: true }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: '关闭提示', exact: true }).click();
  await expect(page.getByRole('button', { name: '导出 PNG', exact: true })).toBeEnabled();
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  await page.screenshot({ path: path.join(examples, 'desktop.png') });
});

test('mixed stack alignment updates the preview and real PNG and survives import, reload and shape switching', async ({ page }) => {
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page).toHaveURL('http://127.0.0.1:5173/');
  await expect(page).toHaveTitle(/FOAM SKU/);
  await applyConfig(page, {
    modules: [
      { id: 'base', unit: 'cm', length: 80, width: 60, thickness: 10, count: 2 },
      { id: 'top', unit: 'cm', length: 40, width: 30, thickness: 5, count: 3 },
    ],
    elevation: 28, exportWidth: 1024, exportHeight: 1024, samples: 16,
  });
  const shapes = page.getByRole('group', { name: '海绵形态', exact: true });
  await expect(shapes.getByRole('button')).toHaveCount(2);
  await expect(shapes.getByRole('button', { name: '整卷', exact: true })).toHaveCount(0);
  const picker = page.getByRole('group', { name: '堆叠对齐', exact: true });
  await expect(picker.getByRole('button')).toHaveCount(9);
  await expect(picker.getByRole('button', { name: '居中对齐', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const centered = await sharp(await downloadImage(page)).ensureAlpha().raw().toBuffer();
  await picker.getByRole('button', { name: '左前对齐', exact: true }).click();
  await expect(picker.getByRole('button', { name: '左前对齐', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  const aligned = await sharp(await downloadImage(page)).ensureAlpha().raw().toBuffer();
  let changedPixels = 0, productPixels = 0;
  for (let i = 0; i < aligned.length; i += 4) {
    if (aligned[i] !== centered[i] || aligned[i + 3] !== centered[i + 3]) changedPixels++;
    if (aligned[i + 3] === 255) productPixels++;
  }
  expect(changedPixels).toBeGreaterThan(10000);
  expect(productPixels).toBeGreaterThan(10000);
  expect(aligned[3]).toBe(0);
  await page.getByRole('button', { name: '关闭提示', exact: true }).click();
  await expect(page.getByRole('button', { name: '导出 PNG', exact: true })).toBeEnabled();
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await fs.mkdir(alignmentScreenshots, { recursive: true });
  await page.screenshot({ path: path.join(alignmentScreenshots, 'desktop.png') });
  const savedEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: '保存参数', exact: true }).click();
  const saved = JSON.parse(await fs.readFile(await (await savedEvent).path(), 'utf8'));
  expect(saved.stackAlignment).toBe('front-left');
  await picker.getByRole('button', { name: '右侧对齐', exact: true }).click();
  await applyConfig(page, saved);
  await expect(picker.getByRole('button', { name: '左前对齐', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('foam-sku:config:v2'))?.stackAlignment === 'front-left');
  await page.reload();
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  await expect(picker.getByRole('button', { name: '左前对齐', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await shapes.getByRole('button', { name: '半卷平铺', exact: true }).click();
  await expect(page.getByLabel('平铺伸出长度数值', { exact: true })).toBeVisible();
  await expect(picker).toHaveCount(0);
  await shapes.getByRole('button', { name: '平板堆叠', exact: true }).click();
  await expect(picker.getByRole('button', { name: '左前对齐', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('group', { name: /^海绵模块/ })).toHaveCount(2);
  await page.getByRole('button', { name: '恢复默认', exact: true }).click();
  await expect(picker.getByRole('button', { name: '居中对齐', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('tab', { name: '场景', exact: true }).click();
  await expect(page.getByRole('switch', { name: '透明背景', exact: true })).toBeChecked();
  expect(errors).toEqual([]);
});

test('alignment controls fit mobile and every position can be selected', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await applyConfig(page, { modules: [{ ...DEFAULT_MODULE }, { ...DEFAULT_MODULE, id: 'small', length: 30, width: 20, count: 1 }], exportWidth: 768, exportHeight: 768, samples: 16 });
  const picker = page.getByRole('group', { name: '堆叠对齐', exact: true });
  for (const label of ['左后', '后侧', '右后', '左侧', '居中', '右侧', '左前', '前侧', '右前']) {
    const button = picker.getByRole('button', { name: `${label}对齐`, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const notification = page.getByRole('button', { name: '关闭提示', exact: true });
  if (await notification.isVisible()) await notification.click();
  await expect(page.getByRole('button', { name: '导出 PNG', exact: true })).toBeEnabled();
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  await fs.mkdir(alignmentScreenshots, { recursive: true });
  await page.screenshot({ path: path.join(alignmentScreenshots, 'mobile.png'), fullPage: true });
});

test('a saved whole roll opens as partial with no tail and keeps the original sheet settings', async ({ page }) => {
  const legacy = { ...DEFAULT_CONFIG, shape: 'roll', rollTailLength: 80, rollRotation: 90, foamColor: '#fff480' };
  await page.addInitScript(value => localStorage.setItem('foam-sku:config:v2', JSON.stringify(value)), legacy);
  await page.goto('/');
  await expect(page.getByTestId('preview')).toHaveAttribute('data-status', 'ready');
  await expect(page.getByRole('button', { name: '半卷平铺', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '整卷', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('平铺伸出长度数值', { exact: true })).toHaveValue('0');
  await expect(page.getByLabel('展开总长度', { exact: true })).toHaveValue('100');
  await expect(page.getByLabel('整体朝向数值', { exact: true })).toHaveValue('90');
  await expect(page.getByLabel('表面颜色', { exact: true })).toHaveValue('#fff480');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('foam-sku:config:v2'))?.shape === 'partial');
});
