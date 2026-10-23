import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig, parseConfig, toDisplay, toCentimeters, exportFilename } from '../src/config.js';

test('inch/cm presentation round trip keeps physical dimensions', () => {
  assert.equal(toDisplay(60.96, 'in'), 24);
  assert.equal(toCentimeters(24, 'in'), 60.96);
  assert.equal(toDisplay(60.96, 'cm'), 60.96);
  for (let i = 0; i < 20; i++) {
    assert.ok(Math.abs(toCentimeters(toDisplay(3.175, 'in'), 'in') - 3.175) < 1e-10);
  }
});

test('unsafe or missing numeric settings cannot create invalid GPU work', () => {
  const c = normalizeConfig({ length: NaN, width: -1, thickness: Infinity, count: 99.7, exportWidth: 99999, exportHeight: 1, radius: -5 });
  assert.equal(c.length, 60.96);
  assert.equal(c.width, 1);
  assert.equal(c.thickness, 10.16);
  assert.equal(c.count, 12);
  assert.equal(c.exportWidth, 4096);
  assert.equal(c.exportHeight, 256);
  assert.equal(c.radius, 0);
  assert.equal(c.elevation, 22);
});

test('transparent background always uses PNG; invalid colors fall back safely', () => {
  const c = normalizeConfig({ transparent: true, format: 'jpeg', background: 'url(evil)', foamColor: '#abc123' });
  assert.equal(c.format, 'png');
  assert.equal(c.background, '#ffffff');
  assert.equal(c.foamColor, '#abc123');
});

test('configuration serialization round trip and unsupported files', () => {
  assert.deepEqual(parseConfig(JSON.stringify(DEFAULT_CONFIG)), DEFAULT_CONFIG);
  for (const value of ['[]', 'null', '{"version":9}', '{"random":"stuff"}', '{bad']) {
    assert.throws(() => parseConfig(value));
  }
  assert.throws(() => parseConfig(' '.repeat(70000)));
});

test('download name describes dimensions, count, resolution and alpha', () => {
  const name = exportFilename(normalizeConfig({ transparent: true, count: 2 }));
  assert.match(name, /24x24x4in_2pcs_2000x2000_alpha\.png$/);
});
