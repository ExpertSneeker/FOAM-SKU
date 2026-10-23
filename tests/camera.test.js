import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import { cameraFor } from '../src/render/camera.js';
import { DEFAULT_CONFIG } from '../src/config.js';

test('perspective camera fits wide, tall and square outputs without clipping', () => {
  for (const [w, h] of [[2000, 2000], [4096, 256], [256, 4096], [1600, 900]]) {
    for (const size of [[60.96, 20.32, 60.96], [299.72, 7.62, 76.2], [1, 960, 1]]) {
      const box = new Box3(new Vector3(-size[0] / 2, 0, -size[2] / 2), new Vector3(size[0] / 2, size[1], size[2] / 2));
      const camera = cameraFor(box, DEFAULT_CONFIG, w, h);
      assert.equal(camera.type, 'PerspectiveCamera');
      assert.ok(Math.abs(camera.getFocalLength() - 65) < 1e-8);
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const p = new Vector3(x, y, z).project(camera);
        assert.ok(Math.abs(p.x) < 0.821 && Math.abs(p.y) < 0.821, `${w}x${h}: ${p.toArray()}`);
        assert.ok(p.z > -1 && p.z < 1, `near/far clip at ${w}x${h}: ${p.z}`);
      }
    }
  }
});
