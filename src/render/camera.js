import { MathUtils, PerspectiveCamera, Vector3 } from 'three';

export function cameraFor(bounds, config, width, height) {
  const aspect = width / height;
  const camera = new PerspectiveCamera(30, aspect, 0.05, 20000);
  camera.setFocalLength(config.focalLength);
  const azimuth = MathUtils.degToRad(config.azimuth);
  const elevation = MathUtils.degToRad(config.elevation);
  const direction = new Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
  const center = bounds.getCenter(new Vector3());
  camera.position.copy(center).add(direction);
  camera.lookAt(center);
  camera.updateMatrixWorld();
  const inverse = camera.quaternion.clone().invert();
  const tanV = Math.tan(MathUtils.degToRad(camera.fov) / 2);
  const tanH = tanV * aspect;
  const corners = [];
  let distance = 0;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const point = new Vector3(x, y, z);
    corners.push(point);
    const local = point.clone().sub(center).applyQuaternion(inverse);
    distance = Math.max(distance, local.z + Math.abs(local.x) / (tanH * config.framing), local.z + Math.abs(local.y) / (tanV * config.framing));
  }
  camera.position.copy(center).addScaledVector(direction, distance);
  // Very wide exports and tall stacks can place the camera far beyond a
  // fixed clip range. Keep depth precision and all corners inside the frustum.
  camera.near = Math.max(0.01, distance / 10000);
  camera.far = distance + bounds.getSize(new Vector3()).length() * 4 + 100;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const projected = corners.map(p => p.clone().project(camera));
  const midX = (Math.min(...projected.map(p => p.x)) + Math.max(...projected.map(p => p.x))) / 2;
  const midY = (Math.min(...projected.map(p => p.y)) + Math.max(...projected.map(p => p.y))) / 2;
  camera.setViewOffset(width, height, midX * width / 2, -midY * height / 2, width, height);
  camera.updateMatrixWorld();
  return camera;
}
