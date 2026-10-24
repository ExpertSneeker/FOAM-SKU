import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3, Texture } from 'three';
import { normalizeConfig, parseConfig, exportFilename } from '../src/config.js';
import { createScene } from '../src/render/scene.js';
import { sampleRollPath } from '../src/roll.js';
import { createRolledFoamGeometry } from '../src/render/rolledGeometry.js';

const sheet = { unit: 'cm', length: 254, width: 60.96, thickness: 2.54 };
const materialSettings = { foamColor: '#fff58c', poreScale: 0.66, poreStrength: 0.34, roughness: 0.92, edgeShade: 0.008 };

test('roll settings round trip while retaining the original independent stack', () => {
  const c = normalizeConfig({ shape: 'partial', sheet, rollInnerDiameter: 10.16, rollTailLength: 45.72, rollSide: 'right', rollRotation: 90, ...materialSettings });
  assert.equal(c.shape, 'partial');
  assert.deepEqual(c.sheet, sheet);
  assert.equal(c.rollTailLength, 45.72);
  assert.equal(c.rollRotation, 90);
  assert.equal(c.rollSide, 'right');
  assert.deepEqual(parseConfig(JSON.stringify(c)), c);
  assert.deepEqual(normalizeConfig({ ...c, shape: 'stack' }).modules, normalizeConfig().modules);
  for (const [key, value] of Object.entries(materialSettings)) assert.equal(c[key], value);
  assert.equal(normalizeConfig().shape, 'stack');
});

test('partial-sheet export names identify single sheets, tail and orientation', () => {
  const c = normalizeConfig({ shape: 'partial', sheet, rollTailLength: 40, rollSide: 'left', rollRotation: 90 });
  assert.match(exportFilename(c), /^foam_partial_254x60\.96x2\.54cm_1pc_tail40cm_left_90deg_/);
  assert.match(exportFilename(normalizeConfig({ ...c, shape: 'roll' })), /^foam_partial_254x60\.96x2\.54cm_1pc_tail0cm_left_90deg_/);
});

test('rolled forms render one grounded mesh and reuse the existing foam material', () => {
  const textures = { map: new Texture(), normalMap: new Texture() };
  for (const shape of ['partial']) {
    const c = normalizeConfig({ shape, sheet, rollTailLength: 45.72, ...materialSettings, modules: [{ count: 8 }, { count: 3, length: 40 }] });
    const bundle = createScene(c, textures, 1200, 900);
    const group = bundle.scene.children.find(child => child.isGroup);
    assert.equal(group.children.length, 1);
    const mesh = group.children[0];
    assert.equal(mesh.geometry.userData.shape, shape);
    assert.equal(mesh.material.map, textures.map);
    assert.equal(mesh.material.normalMap, textures.normalMap);
    assert.equal(mesh.material.color.getHexString(), 'fff58c');
    assert.equal(mesh.material.roughness, 0.92);
    assert.equal(mesh.material.normalScale.x, 0.34);
    const bounds = new Box3().setFromObject(group);
    assert.ok(Math.abs(bounds.min.y) < 1e-4);
    assert.ok(Math.abs(bounds.getSize(new Vector3()).z - sheet.width) < 1e-4);
    for (const attribute of Object.values(mesh.geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite));
    bundle.dispose();
  }
});

test('continuous roll path preserves sheet length and meets the flat tail tangentially', () => {
  const whole = sampleRollPath(sheet, 10.16, 0);
  const partial = sampleRollPath(sheet, 10.16, 45.72);
  assert.ok(partial.turns < whole.turns);
  const points = partial.points;
  const end = points.at(-1), join = points.at(-2), previous = points.at(-3);
  assert.ok(Math.abs(end.x - join.x - 45.72) < 1e-10);
  assert.equal(end.y, join.y);
  assert.equal(join.ty, 0);
  assert.equal(join.tx, 1);
  assert.ok(Math.abs(previous.ty) < 0.03, 'last curved segment approaches the horizontal tangent');
  let actualLength = 0;
  for (let i = 1; i < points.length; i++) actualLength += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  assert.ok(Math.abs(actualLength - sheet.length) < 0.02, 'sampling must not noticeably shorten the foam');
  assert.equal(end.s, sheet.length);
  assert.ok(partial.pitch > sheet.thickness);
});

test('short thick and extreme thin rolls remain finite and reserve at least one turn', () => {
  for (const input of [
    { sheet: { length: 10, width: 1, thickness: 80 }, rollInnerDiameter: 999, rollTailLength: 999 },
    { sheet: { length: 1200, width: 400, thickness: 0.2 }, rollInnerDiameter: 0, rollTailLength: 0 },
    { sheet: { length: NaN, width: -10, thickness: Infinity }, rollInnerDiameter: Infinity, rollTailLength: -100 },
  ]) {
    const c = normalizeConfig({ shape: 'partial', ...input });
    const path = sampleRollPath(c.sheet, c.rollInnerDiameter, c.rollTailLength);
    assert.ok(path.turns >= 1 - 1e-9);
    assert.ok(c.rollTailLength >= 0 && c.rollTailLength < c.sheet.length);
    assert.deepEqual(normalizeConfig(c), c);
    const geometry = createRolledFoamGeometry(c);
    for (const attribute of Object.values(geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite));
    assert.ok(geometry.attributes.position.count < 110000, 'geometry work remains bounded for long, thin foam');
    geometry.dispose();
  }
});

test('left/right mirrored rolls and quarter-turn orientations stay on the ground and in frame', () => {
  let initialSize;
  for (const side of ['left', 'right']) for (const rotation of [0, 90, 180, 270]) {
    const c = normalizeConfig({ shape: 'partial', sheet, rollSide: side, rollRotation: rotation });
    const bundle = createScene(c, {}, 2000, 1000);
    const group = bundle.scene.children.find(child => child.isGroup);
    const bounds = new Box3().setFromObject(group), size = bounds.getSize(new Vector3());
    initialSize ??= size;
    assert.ok(Math.abs(bounds.min.y) < 1e-4);
    assert.equal(group.children[0].scale.x, side === 'left' ? -1 : 1);
    assert.ok(Math.abs(size.x - (rotation % 180 ? initialSize.z : initialSize.x)) < 1e-4);
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const p = new Vector3(x, y, z).project(bundle.camera);
      assert.ok(Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && Math.abs(p.z) < 1);
    }
    bundle.dispose();
  }
});

test('oblique roll orientations retain useful framing around the actual product', () => {
  const c = normalizeConfig({ shape: 'partial', rollTailLength: 0, rollRotation: 60 });
  const bundle = createScene(c, {}, 2000, 2000);
  const mesh = bundle.scene.children.find(child => child.isGroup).children[0];
  const positions = mesh.geometry.attributes.position;
  let minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < positions.count; i++) {
    const p = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).project(bundle.camera);
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    assert.ok(Math.abs(p.x) < 1 && Math.abs(p.y) < 1);
  }
  assert.ok(maxX - minX > 1.3, `roll occupies only ${((maxX - minX) * 50).toFixed(1)}% of the image width`);
  bundle.dispose();
});
