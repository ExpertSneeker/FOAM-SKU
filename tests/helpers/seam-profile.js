import sharp from 'sharp';
import { Vector3 } from 'three';
import { createScene } from '../../src/render/scene.js';

// Measure the three-dimensional contact locations in the actual exported image.
// Average normal-to-edge profiles along each face to remove pixel-grid phase.
export async function measureSeams(file, config) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bundle = createScene(config, {}, info.width, info.height);
  const { camera } = bundle;
  const module = config.modules[0];
  const project = point => {
    const p = new Vector3(...point).project(camera);
    return [(p.x * 0.5 + 0.5) * info.width - 0.5, (0.5 - p.y * 0.5) * info.height - 0.5];
  };
  function sample(x, y) {
    const left = Math.floor(x), top = Math.floor(y), fx = x - left, fy = y - top;
    const value = (dx, dy) => data[((top + dy) * info.width + left + dx) * 4];
    return (value(0, 0) * (1 - fx) + value(1, 0) * fx) * (1 - fy) + (value(0, 1) * (1 - fx) + value(1, 1) * fx) * fy;
  }
  const metrics = [];
  for (const face of ['front', 'right']) for (let seam = 1; seam < module.count; seam++) {
    const y = seam * module.thickness;
    const profile = Array(121).fill(0);
    for (let i = 0; i < 41; i++) {
      const position = -0.3 + 0.6 * i / 40;
      const point = face === 'front' ? [position * module.length, y, module.width / 2] : [module.length / 2, y, position * module.width];
      const along = [...point]; along[face === 'front' ? 0 : 2] += 1;
      const p = project(point), q = project(along), tangent = [q[0] - p[0], q[1] - p[1]];
      const magnitude = Math.hypot(...tangent), normal = [-tangent[1] / magnitude, tangent[0] / magnitude];
      profile.forEach((_, index) => { const distance = (index - 60) / 10; profile[index] += sample(p[0] + normal[0] * distance, p[1] + normal[1] * distance) / 41; });
    }
    const base = [...profile.slice(0, 10), ...profile.slice(-10)].reduce((sum, value) => sum + value, 0) / 20;
    const darkening = base - Math.min(...profile), brightening = Math.max(...profile) - base;
    const area = profile.reduce((sum, value) => sum + Math.max(0, base - value) * 0.1, 0);
    metrics.push({ face, seam, darkening, brightening, equivalentWidth: area / Math.max(darkening, 0.001) });
  }
  bundle.dispose();
  return metrics;
}
