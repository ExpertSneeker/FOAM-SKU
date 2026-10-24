import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import { normalizeConfig } from '../src/config.js';
import { SceneCache } from '../src/render/sceneCache.js';
import { createFrameScheduler } from '../src/render/frameScheduler.js';

test('camera drags and export resolution reuse the model while updating the fitted camera', () => {
  const cache = new SceneCache({});
  for (const shape of ['stack', 'roll', 'partial']) {
    const config = normalizeConfig({ shape, rollRotation: 60 });
    const first = cache.get(config, 900, 900);
    const mesh = first.scene.children.find(child => child.isGroup).children[0];
    const originalCamera = first.camera;
    let disposed = false;
    mesh.geometry.addEventListener('dispose', () => { disposed = true; });
    const moved = cache.get(normalizeConfig({ ...config, azimuth: -25, elevation: 32, focalLength: 80, exportWidth: 2000, exportHeight: 1000, samples: 32 }), 2000, 1000);
    assert.equal(moved, first);
    assert.equal(disposed, false);
    assert.equal(moved.scene.children.find(child => child.isGroup).children[0], mesh);
    assert.equal(moved.camera.aspect, 2);
    assert.ok(Math.abs(moved.camera.getFocalLength() - 80) < 1e-8);
    assert.notDeepEqual(moved.camera.position.toArray(), originalCamera.position.toArray());
    const positions = mesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const point = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).project(moved.camera);
      assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && Math.abs(point.z) < 1);
    }
  }
  cache.dispose();
});

test('material and dimensions invalidate the cached scene and release old geometry', () => {
  const cache = new SceneCache({});
  const config = normalizeConfig();
  const first = cache.get(config, 800, 800);
  const mesh = first.scene.children.find(child => child.isGroup).children[0];
  let disposed = false;
  mesh.geometry.addEventListener('dispose', () => { disposed = true; });
  const changed = normalizeConfig({ ...config, foamColor: '#fff480', modules: [{ ...config.modules[0], length: 90 }] });
  const second = cache.get(changed, 800, 800);
  const group = second.scene.children.find(child => child.isGroup);
  assert.notEqual(second, first);
  assert.equal(disposed, true);
  assert.equal(group.children[0].material.color.getHexString(), 'fff480');
  assert.ok(Math.abs(new Box3().setFromObject(group).getSize(new Vector3()).x - 90) < 1e-4);
  assert.equal(cache.get(normalizeConfig(changed), 800, 800), second);
  let released = false;
  group.children[0].geometry.addEventListener('dispose', () => { released = true; });
  cache.dispose();
  assert.equal(released, true);
});

function frameClock() {
  const callbacks = new Map();
  let id = 0;
  return {
    request(callback) { callbacks.set(++id, callback); return id; },
    cancel(frame) { callbacks.delete(frame); },
    tick() { const current = [...callbacks.values()]; callbacks.clear(); current.forEach(callback => callback()); },
  };
}

test('continuous pointer updates draw the latest view once per frame without waiting for a pause', () => {
  const clock = frameClock(), rendered = [];
  const scheduler = createFrameScheduler(value => rendered.push(value), clock.request, clock.cancel);
  scheduler.schedule(31); scheduler.schedule(28); scheduler.schedule(25);
  assert.deepEqual(rendered, []);
  clock.tick();
  assert.deepEqual(rendered, [25]);
  scheduler.schedule(22); scheduler.schedule(19);
  clock.tick();
  assert.deepEqual(rendered, [25, 19]);
});

test('release commits the last pointer position and cancels queued low-quality frames', () => {
  const clock = frameClock(), rendered = [];
  const scheduler = createFrameScheduler(value => rendered.push(value), clock.request, clock.cancel);
  scheduler.schedule(31); scheduler.schedule(12);
  scheduler.flush();
  clock.tick();
  assert.deepEqual(rendered, [12]);
  scheduler.schedule(-10);
  scheduler.cancel();
  clock.tick();
  assert.deepEqual(rendered, [12]);
});
