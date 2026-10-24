import { BufferGeometry, Float32BufferAttribute } from 'three';
import { sampleRollPath } from '../roll.js';

function roundedSection(thickness, width, radius) {
  const h = thickness / 2, w = width / 2;
  const corners = [[h - radius, w - radius], [-h + radius, w - radius], [-h + radius, -w + radius], [h - radius, -w + radius]];
  const ring = [];
  for (let corner = 0; corner < 4; corner++) {
    for (let i = 0; i <= 5; i++) {
      const angle = (corner + i / 5) * Math.PI / 2;
      ring.push({ q: corners[corner][0] + radius * Math.cos(angle), z: corners[corner][1] + radius * Math.sin(angle), nq: Math.cos(angle), nz: Math.sin(angle) });
    }
  }
  let distance = 0;
  return [...ring, ring[0]].map((point, i) => {
    if (i) distance += Math.hypot(point.q - ring[i - 1].q, point.z - ring[i - 1].z);
    return { ...point, v: distance };
  });
}

function sweepSections(points, radius) {
  if (radius === 0) return points.map(point => ({ ...point, inset: 0, across: 1, along: 0 }));
  const total = points.at(-1).s;
  const pointAt = s => {
    let low = 0, high = points.length - 1;
    while (high - low > 1) {
      const mid = Math.floor((low + high) / 2);
      if (points[mid].s <= s) low = mid; else high = mid;
    }
    const a = points[low], b = points[high], fraction = (s - a.s) / (b.s - a.s);
    const tx = a.tx + (b.tx - a.tx) * fraction, ty = a.ty + (b.ty - a.ty) * fraction;
    const speed = Math.hypot(tx, ty);
    return { x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction, tx: tx / speed, ty: ty / speed, s };
  };
  const tip = sign => Array.from({ length: 6 }, (_, i) => {
    const angle = i * Math.PI / 10;
    const offset = radius * (1 - Math.cos(angle));
    return { ...pointAt(sign < 0 ? offset : total - offset), inset: radius * (1 - Math.sin(angle)), across: Math.sin(angle), along: sign * Math.cos(angle) };
  });
  return [...tip(-1), ...points.filter(p => p.s > radius && p.s < total - radius).map(p => ({ ...p, inset: 0, across: 1, along: 0 })), ...tip(1).reverse()];
}

// One continuous ribbon, including the tangent flat extension. The grain follows
// physical arc length; changing turns or width does not stretch the pore texture.
export function createRolledFoamGeometry(config) {
  const { sheet } = config;
  const tail = config.shape === 'partial' ? config.rollTailLength : 0;
  const path = sampleRollPath(sheet, config.rollInnerDiameter, tail);
  const radius = Math.min(config.radius / 10, sheet.thickness * 0.2, sheet.width * 0.05);
  const ring = roundedSection(sheet.thickness, sheet.width, radius);
  const sections = sweepSections(path.points, radius);
  const stride = ring.length, tile = 8 * config.poreScale;
  const positions = [], normals = [], uv = [], indices = [];
  for (const point of sections) {
    const nx = -point.ty, ny = point.tx;
    const sectionRing = point.inset ? roundedSection(sheet.thickness - 2 * point.inset, sheet.width - 2 * point.inset, Math.max(0, radius - point.inset)) : ring;
    for (const section of sectionRing) {
      positions.push(point.x + nx * section.q, point.y + ny * section.q, section.z);
      normals.push(nx * section.nq * point.across + point.tx * point.along, ny * section.nq * point.across + point.ty * point.along, section.nz * point.across);
      uv.push(point.s / tile, section.v / tile);
    }
  }
  for (let i = 0; i < sections.length - 1; i++) for (let j = 0; j < stride - 1; j++) {
    const a = i * stride + j, b = a + stride;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const capRing = roundedSection(sheet.thickness - 2 * radius, sheet.width - 2 * radius, 0);
  for (const [point, sign] of [[sections[0], -1], [sections.at(-1), 1]]) {
    const center = positions.length / 3;
    positions.push(point.x, point.y, 0);
    normals.push(sign * point.tx, sign * point.ty, 0);
    uv.push(0, 0);
    for (const section of capRing) {
      positions.push(point.x - point.ty * section.q, point.y + point.tx * section.q, section.z);
      normals.push(sign * point.tx, sign * point.ty, 0);
      uv.push(section.q / tile, section.z / tile);
    }
    for (let j = 0; j < stride - 1; j++) {
      if (sign > 0) indices.push(center, center + j + 1, center + j + 2);
      else indices.push(center, center + j + 2, center + j + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, 0);
  geometry.computeBoundingBox();
  geometry.userData = { shape: config.shape, radiusCm: radius, turns: path.turns };
  return geometry;
}
