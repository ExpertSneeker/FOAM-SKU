import sharp from 'sharp';
import { Vector3 } from 'three';
import { createScene } from '../../src/render/scene.js';

// Compare only interior contact bands, away from the stack's outside rims.
// A merged shell cannot respond to radius changes at these locations.
export async function measureRoundingChange(beforeFile, afterFile, config) {
  const [before, after] = await Promise.all([beforeFile, afterFile].map(file => sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
  const { width, height } = after.info;
  const bundle = createScene(config, {}, width, height);
  const module = config.modules[0];
  const project = point => {
    const p = new Vector3(...point).project(bundle.camera);
    return [(p.x * 0.5 + 0.5) * width - 0.5, (0.5 - p.y * 0.5) * height - 0.5];
  };
  const sample = (data, x, y) => {
    const left = Math.floor(x), top = Math.floor(y), fx = x - left, fy = y - top;
    const value = (dx, dy) => data[((top + dy) * width + left + dx) * 4];
    return (value(0, 0) * (1 - fx) + value(1, 0) * fx) * (1 - fy) + (value(0, 1) * (1 - fx) + value(1, 1) * fx) * fy;
  };
  try {
    const metrics = [];
    for (const face of ['front', 'right']) for (let seam = 1; seam < module.count; seam++) {
      let difference = 0, samples = 0;
      for (let i = 0; i < 21; i++) {
        const along = -0.25 + 0.5 * i / 20;
        const point = face === 'front' ? [along * module.length, seam * module.thickness, module.width / 2] : [module.length / 2, seam * module.thickness, along * module.width];
        const p = project(point);
        for (let dy = -8; dy <= 8; dy++) {
          difference += Math.abs(sample(before.data, p[0], p[1] + dy) - sample(after.data, p[0], p[1] + dy));
          samples++;
        }
      }
      metrics.push({ face, seam, meanChange: difference / samples });
    }
    return metrics;
  } finally { bundle.dispose(); }
}
