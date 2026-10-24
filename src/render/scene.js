import * as THREE from 'three';
import { createFoamGeometry, stackRuns } from './geometry.js';
import { cameraFor } from './camera.js';
import { createRolledFoamGeometry } from './rolledGeometry.js';

function createFoamMaterial(config, run, textures) {
  const { length, height: thickness, width: depth, seams } = run;
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
    if (seams.length) {
      shader.uniforms.uFoamSeams = { value: seams.map(seam => new THREE.Vector3(seam.first, seam.spacing, seam.count)) };
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nuniform vec3 uFoamSeams[${seams.length}];`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float seamDistance=1e10;
        for(int i=0;i<${seams.length};i++){
          vec3 seam=uFoamSeams[i];
          float nearest=clamp(floor((vFoamPosition.y-seam.x)/seam.y+0.5),0.0,seam.z-1.0);
          seamDistance=min(seamDistance,abs(vFoamPosition.y-(seam.x+nearest*seam.y)));
        }
        // Use the perpendicular screen-space gradient, so diagonal front/right
        // edges get the same anti-aliasing width instead of Manhattan fwidth.
        float pixelHeight=max(length(vec2(dFdx(vFoamPosition.y),dFdy(vFoamPosition.y))),1e-6);
        float halfWidth=max(0.025/pixelHeight,0.55);
        float seamCoverage=1.0-smoothstep(max(0.0,halfWidth-0.6),halfWidth+0.6,seamDistance/pixelHeight);
        float sidewall=1.0-smoothstep(0.25,0.85,abs(normalize(vFoamNormal).y));
        diffuseColor.rgb*=1.0-0.18*seamCoverage*sidewall;`);
    }
  };
  material.customProgramCacheKey = () => `foam-contact-seams-v2-${seams.length}`;
  return material;
}

export function createScene(config, textures, width, height) {
  const scene = new THREE.Scene();
  scene.background = config.transparent ? null : new THREE.Color(config.background);
  const group = new THREE.Group();
  scene.add(group);
  const resources = [];
  const addFoam = (geometry, run, flip = 1) => {
    const material = createFoamMaterial(config, run, textures);
    resources.push({ geometry, material });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.fromArray(run.center);
    mesh.scale.x = flip;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  };
  if (config.shape === 'roll' || config.shape === 'partial') {
    const geometry = createRolledFoamGeometry(config);
    const size = geometry.boundingBox.getSize(new THREE.Vector3());
    addFoam(geometry, { length: size.x, height: size.y, width: size.z, center: [0, size.y / 2, 0], seams: [] }, config.rollSide === 'left' ? -1 : 1);
    group.rotation.y = THREE.MathUtils.degToRad(config.rollRotation);
  } else {
    for (const run of stackRuns(config.modules)) {
      addFoam(createFoamGeometry(run.length, run.height, run.width, Math.min(config.radius, run.minThickness * 2), config.poreScale), run);
    }
  }
  const bounds = new THREE.Box3().setFromObject(group);
  let fitPoints;
  if (config.shape === 'roll' || config.shape === 'partial') {
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
