import { BoxGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const pieceCenters = (thickness, count) => Array.from({ length: count }, (_, i) => [0, thickness / 2 + i * thickness, 0]);

// Modules are listed from the ground upwards. A shared cumulative base keeps
// adjacent faces touching even when the next module has a different thickness.
export function stackPieces(modules) {
  let base = 0;
  return modules.flatMap((module, moduleIndex) => {
    const pieces = pieceCenters(module.thickness, module.count).map(center => ({ moduleIndex, center: [0, base + center[1], 0] }));
    base += module.thickness * module.count;
    return pieces;
  });
}

// Matching footprints share a continuous sidewall: two rounded rims at every
// contact create subpixel highlights and shadow-map noise instead of a seam.
// Keep the physical interfaces as compact, regularly spaced height ranges.
export function stackRuns(modules) {
  const runs = [];
  let base = 0;
  for (const module of modules) {
    let run = runs.at(-1);
    if (!run || Math.abs(run.length - module.length) > 1e-6 || Math.abs(run.width - module.width) > 1e-6) {
      run = { length: module.length, width: module.width, base, height: 0, minThickness: module.thickness, parts: [] };
      runs.push(run);
    }
    run.parts.push({ offset: run.height, thickness: module.thickness, count: module.count });
    run.height += module.thickness * module.count;
    run.minThickness = Math.min(run.minThickness, module.thickness);
    base += module.thickness * module.count;
  }
  return runs.map(run => ({
    ...run, center: [0, run.base + run.height / 2, 0],
    seams: run.parts.flatMap((part, index) => {
      const count = part.count - (index === run.parts.length - 1 ? 1 : 0);
      return count > 0 ? [{ first: part.offset + part.thickness - run.height / 2, spacing: part.thickness, count }] : [];
    }),
  }));
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
