import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import { normalizeConfig, parseConfig, loadSavedConfig, STORAGE_KEY } from '../src/config.js';
import { stackPieces } from '../src/render/geometry.js';
import { createScene } from '../src/render/scene.js';
import { SceneCache } from '../src/render/sceneCache.js';

const modules = [
  { id: 'base', unit: 'cm', length: 80, width: 60, thickness: 10, count: 2 },
  { id: 'top', unit: 'cm', length: 40, width: 30, thickness: 5, count: 3 },
];
const positions = [
  ['back-left', -20, -15], ['back-center', 0, -15], ['back-right', 20, -15],
  ['center-left', -20, 0], ['center', 0, 0], ['center-right', 20, 0],
  ['front-left', -20, 15], ['front-center', 0, 15], ['front-right', 20, 15],
];

test('nine stack alignments move mixed footprints while preserving all contact heights', () => {
  for (const [alignment, x, z] of positions) {
    const pieces = stackPieces(modules, alignment);
    assert.deepEqual(pieces.map(p => p.center), [[0, 5, 0], [0, 15, 0], [x, 22.5, z], [x, 27.5, z], [x, 32.5, z]], alignment);
  }
});

test('alignment uses the whole footprint and survives module reordering', () => {
  const crossed = [{ ...modules[0], width: 30 }, { ...modules[1], width: 60 }];
  const pieces = stackPieces(crossed, 'front-left');
  assert.deepEqual(pieces.map(piece => piece.center), [[0, 5, 15], [0, 15, 15], [-20, 22.5, 0], [-20, 27.5, 0], [-20, 32.5, 0]]);
  const reversed = stackPieces([...crossed].reverse(), 'front-left');
  assert.deepEqual(reversed.map(piece => [piece.center[0], piece.center[2]]), [[-20, 0], [-20, 0], [-20, 0], [0, 15], [0, 15]]);
});

test('alignment survives JSON and browser storage while old and invalid settings remain centered', () => {
  const config = normalizeConfig({ modules, stackAlignment: 'front-right' });
  assert.equal(parseConfig(JSON.stringify(config)).stackAlignment, 'front-right');
  const storage = { getItem: key => key === STORAGE_KEY ? JSON.stringify(config) : null };
  assert.equal(loadSavedConfig(storage).stackAlignment, 'front-right');
  assert.equal(normalizeConfig().stackAlignment, 'center');
  for (const stackAlignment of [null, {}, 'invalid', 1]) assert.equal(normalizeConfig({ stackAlignment }).stackAlignment, 'center');
  assert.equal(parseConfig(JSON.stringify({ version: 1, length: 80 })).stackAlignment, 'center');
  assert.equal(normalizeConfig({ ...config, shape: 'partial' }).stackAlignment, 'front-right');
});

test('aligned scenes place real mesh edges together and fit both export orientations', () => {
  for (const [stackAlignment] of positions) for (const [width, height] of [[1600, 600], [600, 1600]]) {
    const config = normalizeConfig({ modules, stackAlignment, azimuth: -31, elevation: 35 });
    const bundle = createScene(config, {}, width, height);
    const group = bundle.scene.children.find(child => child.isGroup);
    const boxes = group.children.map(mesh => new Box3().setFromObject(mesh));
    const base = boxes[1], top = boxes[2];
    const edge = stackAlignment.includes('left') ? 'min' : stackAlignment.includes('right') ? 'max' : null;
    if (edge) assert.ok(Math.abs(base[edge].x - top[edge].x) < 1e-4, stackAlignment);
    if (stackAlignment.startsWith('front')) assert.ok(Math.abs(base.max.z - top.max.z) < 1e-4);
    if (stackAlignment.startsWith('back')) assert.ok(Math.abs(base.min.z - top.min.z) < 1e-4);
    assert.ok(Math.abs(base.max.y - top.min.y) < 1e-4);
    for (const box of boxes) for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const p = new Vector3(x, y, z).project(bundle.camera);
      assert.ok(Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && Math.abs(p.z) < 1, `${stackAlignment} ${width}x${height}`);
    }
    bundle.dispose();
  }
});

test('changing alignment rebuilds cached mesh placement and releases the old scene', () => {
  const cache = new SceneCache({});
  const config = normalizeConfig({ modules });
  const first = cache.get(config, 800, 800);
  let disposed = false;
  first.scene.children.find(child => child.isGroup).children[0].geometry.addEventListener('dispose', () => { disposed = true; });
  const next = cache.get(normalizeConfig({ ...config, stackAlignment: 'front-left' }), 800, 800);
  assert.notEqual(next, first);
  assert.equal(disposed, true);
  assert.deepEqual(next.scene.children.find(child => child.isGroup).children[2].position.toArray(), [-20, 22.5, 15]);
  cache.dispose();
});

test('old whole-roll files and storage migrate to a zero-tail partial sheet without losing other settings', () => {
  const old = { ...normalizeConfig({ modules, stackAlignment: 'front-left' }), shape: 'roll', rollTailLength: 70, rollRotation: 90, foamColor: '#fff480' };
  const migrated = parseConfig(JSON.stringify(old));
  assert.equal(migrated.shape, 'partial');
  assert.equal(migrated.rollTailLength, 0);
  assert.equal(migrated.rollRotation, 90);
  assert.equal(migrated.foamColor, '#fff480');
  assert.deepEqual(migrated.sheet, old.sheet);
  assert.deepEqual(migrated.modules, modules);
  assert.equal(migrated.stackAlignment, 'front-left');
  assert.deepEqual(normalizeConfig(migrated), migrated);
  assert.deepEqual(loadSavedConfig({ getItem: key => key === STORAGE_KEY ? JSON.stringify(old) : null }), migrated);
  const bundle = createScene(migrated, {}, 800, 800);
  const mesh = bundle.scene.children.find(child => child.isGroup).children[0];
  assert.equal(mesh.geometry.userData.shape, 'partial');
  assert.ok(mesh.geometry.userData.turns >= 1);
  bundle.dispose();
});
