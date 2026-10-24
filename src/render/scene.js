import * as THREE from 'three';
import { createFoamGeometry, stackPieces } from './geometry.js';
import { cameraFor } from './camera.js';
import { createRolledFoamGeometry } from './rolledGeometry.js';

function createFoamMaterial(config, dimensions, textures) {
  const { length, height: thickness, width: depth } = dimensions;
  const material = new THREE.MeshStandardMaterial({
    color: config.foamColor, map: textures.map ?? null, normalMap: textures.normalMap ?? null,
    normalScale: new THREE.Vector2(config.poreStrength, config.poreStrength), roughness: config.roughness, metalness: 0,
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.uFoamHalfSize = { value: new THREE.Vector3(length / 2, thickness / 2, depth / 2) };
    shader.uniforms.uEdgeShade = { value: config.edgeShade };
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFoamPosition;\nvarying vec3 vFoamNormal;');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFoamPosition=position;\nvFoamNormal=normal;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFoamPosition;\nvarying vec3 vFoamNormal;\nuniform vec3 uFoamHalfSize;\nuniform float uEdgeShade;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float edgeDistance=min(uFoamHalfSize.x-abs(vFoamPosition.x),uFoamHalfSize.z-abs(vFoamPosition.z));
      float upperFace=smoothstep(0.65,0.98,normalize(vFoamNormal).y);
      float edgeBand=1.0-smoothstep(0.0,1.8,edgeDistance);
      diffuseColor.rgb*=1.0-uEdgeShade*upperFace*edgeBand;`);
  };
  material.customProgramCacheKey = () => 'foam-rounded-piece-v1';
  return material;
}

export function createScene(config, textures, width, height) {
  const scene = new THREE.Scene();
  scene.background = config.transparent ? null : new THREE.Color(config.background);
  const group = new THREE.Group();
  scene.add(group);
  const resources = new Map();
  const addFoam = (key, makeGeometry, dimensions, flip = 1) => {
    if (!resources.has(key)) resources.set(key, { geometry: makeGeometry(), material: createFoamMaterial(config, dimensions, textures) });
    const { geometry, material } = resources.get(key);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.fromArray(dimensions.center);
    mesh.scale.x = flip;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  };
  if (config.shape === 'partial') {
    const geometry = createRolledFoamGeometry(config);
    const size = geometry.boundingBox.getSize(new THREE.Vector3());
    addFoam('sheet', () => geometry, { length: size.x, height: size.y, width: size.z, center: [0, size.y / 2, 0] }, config.rollSide === 'left' ? -1 : 1);
    group.rotation.y = THREE.MathUtils.degToRad(config.rollRotation);
  } else {
    for (const piece of stackPieces(config.modules, config.stackAlignment)) {
      const { length, width, thickness } = config.modules[piece.moduleIndex];
      // Every sheet keeps its own rounded top and bottom, even at touching rims.
      // Identical dimensions can share resources without merging their shapes.
      addFoam(`${length},${thickness},${width}`, () => createFoamGeometry(length, thickness, width, config.radius, config.poreScale), { length, height: thickness, width, center: piece.center });
    }
  }
  const bounds = new THREE.Box3().setFromObject(group);
  let fitPoints;
  if (config.shape === 'partial') {
    // Keep the product's oriented box. Refitting its world-aligned box after
    // rotation adds empty corners and makes oblique rolls unnecessarily small.
    const mesh = group.children[0], box = mesh.geometry.boundingBox;
    fitPoints = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      fitPoints.push(new THREE.Vector3(x, y, z).applyMatrix4(mesh.matrixWorld));
    }
  }
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const extent = Math.max(size.x, size.y, size.z);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(extent * 20, extent * 20), new THREE.ShadowMaterial({ color: '#555555', opacity: config.shadowOpacity }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.012;
  ground.receiveShadow = true;
  ground.visible = config.shadow;
  scene.add(ground);
  scene.add(new THREE.HemisphereLight('#ffffff', '#f6f6f6', 1.95 * config.lighting));
  const top = new THREE.DirectionalLight('#ffffff', config.topLight * config.lighting);
  top.position.set(0, extent * 6, 0);
  top.target.position.copy(center);
  scene.add(top, top.target);
  const key = new THREE.DirectionalLight('#ffffff', 0.85 * config.lighting);
  key.position.set(-extent * 1.1, extent * 4.5, extent * 1.4);
  key.target.position.copy(center);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -extent * 0.9, right: extent * 0.9, top: extent * 0.9, bottom: -extent * 0.9, near: 0.1, far: extent * 8 });
  key.shadow.bias = -0.00006;
  key.shadow.normalBias = 0.015;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight('#ffffff', 0.55 * config.lighting);
  fill.position.set(extent * 1.8, extent * 0.9, -extent * 1.3);
  fill.target.position.copy(center);
  scene.add(fill, fill.target);
  return {
    scene, key, extent, keyPosition: key.position.clone(), camera: cameraFor(bounds, config, width, height, fitPoints),
    updateCamera(nextConfig, nextWidth, nextHeight) {
      this.camera = cameraFor(bounds, nextConfig, nextWidth, nextHeight, fitPoints);
    },
    dispose() {
      resources.forEach(({ geometry, material }) => { geometry.dispose(); material.dispose(); });
      ground.geometry.dispose(); ground.material.dispose();
      key.shadow.map?.dispose(); key.shadow.mapPass?.dispose();
    },
  };
}
