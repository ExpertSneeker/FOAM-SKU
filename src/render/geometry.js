import { BoxGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { STACK_ALIGNMENTS } from '../config.js';

export const pieceCenters = (thickness, count) => Array.from({ length: count }, (_, i) => [0, thickness / 2 + i * thickness, 0]);

function stackOffsets(modules, alignment) {
  const { x, z } = STACK_ALIGNMENTS.find(item => item.id === alignment) ?? { x: 0, z: 0 };
  const length = Math.max(0, ...modules.map(module => module.length));
  const width = Math.max(0, ...modules.map(module => module.width));
  return modules.map(module => [x * (length - module.length) / 2 || 0, z * (width - module.width) / 2 || 0]);
}

// Modules are listed from the ground upwards. A shared cumulative base keeps
// adjacent faces touching even when the next module has a different thickness.
export function stackPieces(modules, alignment = 'center') {
  const offsets = stackOffsets(modules, alignment);
  let base = 0;
  return modules.flatMap((module, moduleIndex) => {
    const [x, z] = offsets[moduleIndex];
    const pieces = pieceCenters(module.thickness, module.count).map(center => ({ moduleIndex, center: [x, base + center[1], z] }));
    base += module.thickness * module.count;
    return pieces;
  });
}

export function createFoamGeometry(length, thickness, width, radiusMm, poreScale) {
  const radius = Math.min(radiusMm / 10, thickness * 0.2, length * 0.05, width * 0.05);
  const geometry = radius > 0 ? new RoundedBoxGeometry(length, thickness, width, 5, radius) : new BoxGeometry(length, thickness, width).toNonIndexed();
  const positions = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const tileCm = 8 * poreScale;
  for (const group of geometry.groups) {
    const axis = Math.floor(group.materialIndex / 2);
    for (let i = group.start; i < group.start + group.count; i++) {
      const u = axis === 0 ? positions.getZ(i) : positions.getX(i);
      const v = axis === 1 ? positions.getZ(i) : positions.getY(i);
      uv.setXY(i, u / tileCm, v / tileCm);
    }
  }
  uv.needsUpdate = true;
  geometry.userData.radiusCm = radius;
  geometry.computeBoundingBox();
  return geometry;
}
