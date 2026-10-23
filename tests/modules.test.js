import test from 'node:test';
import assert from 'node:assert/strict';
import * as config from '../src/config.js';
import * as geometry from '../src/render/geometry.js';
import { createScene } from '../src/render/scene.js';
import { Box3, Vector3 } from 'three';

const mixed = [
  { id: 'base', unit: 'cm', length: 80, width: 60, thickness: 10, count: 2 },
  { id: 'top', unit: 'in', length: 40, width: 30, thickness: 5, count: 3 },
];

test('saved Chrome appearance becomes the default without shared mutable modules', () => {
  const c = config.normalizeConfig();
  assert.equal(c.version, 2);
  assert.deepEqual(c.modules, [{ id: 'module-1', unit: 'in', length: 60.96, width: 60.96, thickness: 10.16, count: 2 }]);
  for (const [key, value] of Object.entries({ radius: 0.7, poreStrength: 0, poreScale: 0.66, elevation: 11, framing: 0.84, lighting: 1.02, topLight: 0.32, samples: 64 })) assert.equal(c[key], value);
  c.modules[0].length = 100;
  assert.equal(config.DEFAULT_CONFIG.modules[0].length, 60.96);
});

test('v1 files migrate dimensions, units and appearance to one module', () => {
  const legacy = { version: 1, unit: 'cm', length: 91, width: 52, thickness: 3, count: 4, elevation: 17, radius: 0.7, transparent: true, samples: 32 };
  const c = config.parseConfig(JSON.stringify(legacy));
  assert.equal(c.version, 2);
  assert.deepEqual(c.modules[0], { id: 'module-1', unit: 'cm', length: 91, width: 52, thickness: 3, count: 4 });
  assert.equal(c.elevation, 17); assert.equal(c.transparent, true); assert.equal(c.samples, 32);
  assert.equal('length' in c, false);
});

test('v2 modules round trip in order and malformed lists are rejected', () => {
  const c = config.normalizeConfig({ modules: mixed });
  assert.deepEqual(config.parseConfig(JSON.stringify(c)), c);
  for (const modules of [[], null, {}, [null], Array(13).fill(mixed[0])]) {
    assert.throws(() => config.parseConfig(JSON.stringify({ version: 2, modules })));
  }
  const safe = config.normalizeConfig({ modules: [mixed[0], { ...mixed[1], id: 'base', thickness: -1, count: 99 }] });
  assert.notEqual(safe.modules[0].id, safe.modules[1].id);
  assert.equal(safe.modules[1].thickness, 0.2); assert.equal(safe.modules[1].count, 12);
  assert.equal(safe.modules[0].unit, 'cm'); assert.equal(safe.modules[1].unit, 'in');
});

test('unequal slabs touch at cumulative heights and remain centered in both axes', () => {
  const pieces = geometry.stackPieces(mixed);
  assert.equal(pieces.length, 5);
  assert.deepEqual(pieces.map(p => p.center), [[0, 5, 0], [0, 15, 0], [0, 22.5, 0], [0, 27.5, 0], [0, 32.5, 0]]);
  assert.deepEqual(pieces.map(p => p.moduleIndex), [0, 0, 1, 1, 1]);
  const reordered = geometry.stackPieces([...mixed].reverse());
  assert.deepEqual(reordered.map(p => p.center[1]), [2.5, 7.5, 12.5, 20, 30]);
});

test('render scene uses each module dimensions and distinct shader half sizes', () => {
  const c = config.normalizeConfig({ modules: mixed });
  const result = createScene(c, {}, 1200, 900);
  const meshes = result.scene.children.find(child => child.isGroup).children;
  assert.equal(meshes.length, 5);
  const boxes = meshes.map(mesh => new Box3().setFromObject(mesh));
  boxes.forEach((box, index) => {
    const size = box.getSize(new Vector3());
    assert.ok(Math.abs(size.x - (index < 2 ? 80 : 40)) < 1e-4);
    assert.ok(Math.abs(size.y - (index < 2 ? 10 : 5)) < 1e-4);
    if (index) assert.ok(Math.abs(box.min.y - boxes[index - 1].max.y) < 1e-4);
  });
  assert.equal(meshes[0].geometry, meshes[1].geometry);
  assert.notEqual(meshes[0].material, meshes[2].material);
  for (const index of [0, 2]) {
    const shader = { uniforms: {}, vertexShader: '', fragmentShader: '' };
    meshes[index].material.onBeforeCompile(shader);
    assert.equal(shader.uniforms.uFoamHalfSize.value.y, index === 0 ? 5 : 2.5);
  }
  result.dispose();
});

test('mixed-stack filenames include ordered dimensions and stay safe on Windows', () => {
  const c = config.normalizeConfig({ modules: mixed, transparent: true });
  const name = config.exportFilename(c);
  assert.match(name, /^foam_stack_80x60x10cm-2pcs_/);
  assert.match(name, /_5pcs_2000x2000_alpha\.png$/);
  assert.ok(config.exportFilename(config.normalizeConfig({ modules: Array.from({ length: 12 }, (_, i) => ({ ...mixed[0], id: `m${i}`, length: 399.999, count: 12 })) })).length < 200);
});
