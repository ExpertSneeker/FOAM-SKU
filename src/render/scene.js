import * as THREE from 'three';
import { createFoamGeometry, pieceCenters } from './geometry.js';
import { cameraFor } from './camera.js';

export function createScene(config, textures, width, height) {
  const { length, thickness, width: depth, count } = config;
  const scene = new THREE.Scene();
  scene.background = config.transparent ? null : new THREE.Color(config.background);
  const group = new THREE.Group();
  scene.add(group);
  const material = new THREE.MeshStandardMaterial({
    color: config.foamColor, map: textures.map, normalMap: textures.normalMap,
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
  material.customProgramCacheKey = () => 'foam-soft-edge-v1';
  const geometry = createFoamGeometry(length, thickness, depth, config.radius, config.poreScale);
  for (const center of pieceCenters(thickness, count)) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.fromArray(center);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  const bounds = new THREE.Box3().setFromObject(group);
  const center = bounds.getCenter(new THREE.Vector3());
  const extent = Math.max(length, depth, thickness * count);
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
    scene, key, extent, camera: cameraFor(bounds, config, width, height),
    dispose() {
      geometry.dispose(); material.dispose(); ground.geometry.dispose(); ground.material.dispose();
      key.shadow.map?.dispose(); key.shadow.mapPass?.dispose();
    },
  };
}
