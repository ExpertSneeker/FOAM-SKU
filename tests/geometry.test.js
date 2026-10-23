import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { createFoamGeometry, pieceCenters } from '../src/render/geometry.js';

test('multiple pieces meet exactly with no gap or horizontal stagger', () => {
  const centers = pieceCenters(10.16, 3);
  assert.equal(centers.length, 3);
  centers.forEach((p, i) => {
    assert.equal(p[0], 0); assert.equal(p[2], 0);
    assert.equal(p[1], 5.08 + i * 10.16);
    if (i) assert.ok(Math.abs(p[1] - centers[i - 1][1] - 10.16) < 1e-10);
  });
});

test('rounded edges preserve the requested outer SKU dimensions', () => {
  const geometry = createFoamGeometry(60.96, 10.16, 60.96, 2.8, 1);
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new Vector3());
  for (const [actual, expected] of [[size.x, 60.96], [size.y, 10.16], [size.z, 60.96]]) assert.ok(Math.abs(actual - expected) < 0.0001, `${actual} != ${expected}`);
  assert.ok(Math.abs(geometry.userData.radiusCm - 0.28) < 1e-10);
  assert.ok(geometry.attributes.position.count > 24);
  geometry.dispose();
});

test('radius is constrained on thin sheets and texture UVs keep physical scale', () => {
  const small = createFoamGeometry(10, 0.2, 10, 20, 1);
  assert.ok(small.userData.radiusCm <= 0.1);
  const large = createFoamGeometry(100, 10, 10, 2.8, 1);
  assert.ok(Math.max(...large.attributes.uv.array) > 5);
  small.dispose(); large.dispose();
});
