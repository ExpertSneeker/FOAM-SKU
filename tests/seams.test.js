import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import * as geometry from '../src/render/geometry.js';
import { createScene } from '../src/render/scene.js';
import { normalizeConfig } from '../src/config.js';

const slab = { id: 'a', unit: 'cm', length: 60, width: 40, thickness: 10, count: 4 };

test('four touching slabs have one continuous outer wall and three exact seam heights', () => {
  const runs = geometry.stackRuns([slab]);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].height, 40);
  assert.deepEqual(runs[0].center, [0, 20, 0]);
  assert.deepEqual(runs[0].seams, [{ first: -10, spacing: 10, count: 3 }]);
  const bundle = createScene(normalizeConfig({ modules: [slab] }), {}, 2000, 2000);
  const meshes = bundle.scene.children.find(child => child.isGroup).children;
  assert.equal(meshes.length, 1);
  assert.ok(meshes[0].geometry.userData.radiusCm > 0);
  const size = new Box3().setFromObject(meshes[0]).getSize(new Vector3());
  assert.ok(size.distanceTo(new Vector3(60, 40, 40)) < 1e-4);
  const shader = { uniforms: {}, vertexShader: '', fragmentShader: '' };
  meshes[0].material.onBeforeCompile(shader);
  assert.deepEqual(shader.uniforms.uFoamSeams.value.map(v => v.toArray()), [[-10, 10, 3]]);
  bundle.dispose();
});

test('same footprint merges across modules with unequal thickness, retaining every interface', () => {
  const [run] = geometry.stackRuns([{ ...slab, count: 2 }, { ...slab, id: 'b', thickness: 5, count: 3 }]);
  assert.equal(run.height, 35);
  assert.deepEqual(run.seams, [{ first: -7.5, spacing: 10, count: 2 }, { first: 7.5, spacing: 5, count: 2 }]);
  const heights = run.seams.flatMap(part => Array.from({ length: part.count }, (_, i) => part.first + part.spacing * i + run.center[1]));
  assert.deepEqual(heights, [10, 20, 25, 30]);
});

test('different footprints keep their ledges and only adjacent matching footprints merge', () => {
  const runs = geometry.stackRuns([{ ...slab, count: 2 }, { ...slab, length: 30, thickness: 5, count: 1 }, { ...slab, count: 1 }]);
  assert.equal(runs.length, 3);
  assert.deepEqual(runs.map(run => run.center[1]), [10, 22.5, 30]);
  assert.deepEqual(runs.map(run => run.seams.length), [1, 0, 0]);
});

test('single slabs have no artificial boundary and thin layers still constrain outer rounding', () => {
  const [single] = geometry.stackRuns([{ ...slab, count: 1 }]);
  assert.deepEqual(single.seams, []);
  const bundle = createScene(normalizeConfig({ modules: [{ ...slab, thickness: 0.2, count: 12 }], radius: 20 }), {}, 1000, 1000);
  const mesh = bundle.scene.children.find(child => child.isGroup).children[0];
  assert.ok(mesh.geometry.userData.radiusCm <= 0.04 + 1e-9);
  bundle.dispose();
});
