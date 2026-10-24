import { createScene } from './scene.js';

export class SceneCache {
  constructor(textures) {
    this.textures = textures;
    this.bundle = null;
    this.key = null;
  }

  get(config, width, height) {
    // Camera and output changes do not change geometry, materials, or lighting.
    const { azimuth, elevation, focalLength, framing, exportWidth, exportHeight, samples, format, ...sceneConfig } = config;
    const key = JSON.stringify(sceneConfig);
    if (!this.bundle || key !== this.key) {
      const bundle = createScene(config, this.textures, width, height);
      this.dispose();
      this.bundle = bundle;
      this.key = key;
    } else {
      this.bundle.updateCamera(config, width, height);
    }
    return this.bundle;
  }

  dispose() {
    this.bundle?.dispose();
    this.bundle = null;
    this.key = null;
  }
}
