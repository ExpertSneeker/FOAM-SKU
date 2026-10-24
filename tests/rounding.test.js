import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import { createScene } from '../src/render/scene.js';
import { normalizeConfig } from '../src/config.js';

const slab = { id: 'a', unit: 'cm', length: 60, width: 40, thickness: 10, count: 4 };
const meshesIn = bundle => bundle.scene.children.find(child => child.isGroup).children;

test('every slab has its own rounded upper and lower rim, including interior contacts', () => {
  const bundle = createScene(normalizeConfig({ modules: [slab], radius: 18.2 }), {}, 2000, 2000);
  const meshes = meshesIn(bundle);
  assert.equal(meshes.length, 4);
  assert.deepEqual(meshes.map(mesh => mesh.position.toArray()), [[0, 5, 0], [0, 15, 0], [0, 25, 0], [0, 35, 0]]);
  for (const mesh of meshes) {
    const size = new Box3().setFromObject(mesh).getSize(new Vector3());
    assert.ok(size.distanceTo(new Vector3(60, 10, 40)) < 1e-4);
    assert.ok(Math.abs(mesh.geometry.userData.radiusCm - 1.82) < 1e-9);
    const positions = mesh.geometry.attributes.position;
    for (const side of [-1, 1]) {
      let rimVertices = 0, maxZ = -Infinity;
      for (let i = 0; i < positions.count; i++) {
        if (Math.abs(positions.getY(i) - side * 5) < 1e-4) {
          rimVertices++;
          maxZ = Math.max(maxZ, positions.getZ(i));
        }
      }
      assert.ok(rimVertices > 0);
      assert.ok(Math.abs(maxZ - 18.18) < 1e-4, 'both flat faces end before the front wall, leaving a real roundover');
    }
  }
  const group = bundle.scene.children.find(child => child.isGroup);
  assert.ok(new Box3().setFromObject(group).getSize(new Vector3()).distanceTo(new Vector3(60, 40, 40)) < 1e-4);
  bundle.dispose();
});

test('mixed thicknesses round independently while preserving alignment and exact touching heights', () => {
  const config = normalizeConfig({ modules: [{ ...slab, count: 2 }, { ...slab, id: 'b', length: 30, width: 20, thickness: 0.2, count: 2 }], radius: 18.2, stackAlignment: 'front-left' });
  const bundle = createScene(config, {}, 1000, 1000);
  const meshes = meshesIn(bundle);
  assert.equal(meshes.length, 4);
  assert.deepEqual(meshes.map(mesh => [mesh.position.x, mesh.position.z]), [[0, 0], [0, 0], [-15, 10], [-15, 10]]);
  const boxes = meshes.map(mesh => new Box3().setFromObject(mesh));
  for (let i = 1; i < boxes.length; i++) assert.ok(Math.abs(boxes[i].min.y - boxes[i - 1].max.y) < 1e-4);
  for (const mesh of meshes.slice(0, 2)) assert.ok(Math.abs(mesh.geometry.userData.radiusCm - 1.82) < 1e-9);
  for (const mesh of meshes.slice(2)) assert.ok(Math.abs(mesh.geometry.userData.radiusCm - 0.04) < 1e-9);
  bundle.dispose();
});

test('equal footprints across modules keep separate rims at their true contact heights', () => {
  const bundle = createScene(normalizeConfig({ modules: [{ ...slab, count: 2 }, { ...slab, id: 'b', thickness: 5, count: 3 }], radius: 20 }), {}, 1200, 900);
  const meshes = meshesIn(bundle);
  assert.equal(meshes.length, 5);
  assert.deepEqual(meshes.map(mesh => mesh.position.y), [5, 15, 22.5, 27.5, 32.5]);
  assert.deepEqual(meshes.map(mesh => mesh.geometry.userData.radiusCm), [2, 2, 1, 1, 1]);
  bundle.dispose();
});

test('zero-radius and single-sheet stacks retain exact outer dimensions', () => {
  for (const count of [1, 4]) {
    const bundle = createScene(normalizeConfig({ modules: [{ ...slab, count }], radius: 0 }), {}, 1000, 1000);
    const meshes = meshesIn(bundle);
    assert.equal(meshes.length, count);
    for (const mesh of meshes) {
      assert.equal(mesh.geometry.userData.radiusCm, 0);
      assert.ok(new Box3().setFromObject(mesh).getSize(new Vector3()).distanceTo(new Vector3(60, 10, 40)) < 1e-4);
    }
    bundle.dispose();
  }
});

test('identical slab dimensions reuse geometry and material and dispose each resource once', () => {
  const config = normalizeConfig({ modules: Array.from({ length: 12 }, (_, i) => ({ ...slab, id: `m${i}`, count: 12 })) });
  const bundle = createScene(config, {}, 1000, 1000);
  const meshes = meshesIn(bundle);
  assert.equal(meshes.length, 144);
  assert.equal(new Set(meshes.map(mesh => mesh.geometry)).size, 1);
  assert.equal(new Set(meshes.map(mesh => mesh.material)).size, 1);
  let geometriesDisposed = 0, materialsDisposed = 0;
  meshes[0].geometry.addEventListener('dispose', () => { geometriesDisposed++; });
  meshes[0].material.addEventListener('dispose', () => { materialsDisposed++; });
  bundle.dispose();
  assert.equal(geometriesDisposed, 1);
  assert.equal(materialsDisposed, 1);
});
