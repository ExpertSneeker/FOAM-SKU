const TAU = Math.PI * 2;

export const rollPitch = thickness => thickness + Math.min(0.08, thickness * 0.025);

// Arc length of r = a + b * angle, measured along the middle of the sheet.
export function spiralLength(angle, a, b) {
  const integral = r => (r * Math.hypot(r, b) + b * b * Math.asinh(r / b)) / (2 * b);
  return integral(a + b * angle) - integral(a);
}

export function getRollLimits(sheet, innerDiameter) {
  const t = sheet.thickness;
  const minDiameter = 2 * t;
  const maxDiameter = Math.max(minDiameter, Math.min(200, sheet.length / Math.PI - 2.1 * t));
  const diameter = Math.max(minDiameter, Math.min(maxDiameter, innerDiameter ?? minDiameter));
  const minimumLength = spiralLength(TAU, (diameter + t) / 2, rollPitch(t) / TAU);
  return { minDiameter, maxDiameter, maxTail: Math.max(0, sheet.length - minimumLength) };
}

export function sampleRollPath(sheet, innerDiameter, tailLength = 0) {
  const a = (innerDiameter + sheet.thickness) / 2;
  const b = rollPitch(sheet.thickness) / TAU;
  const rolledLength = sheet.length - tailLength;
  let low = 0, high = rolledLength / a;
  for (let i = 0; i < 52; i++) {
    const middle = (low + high) / 2;
    if (spiralLength(middle, a, b) < rolledLength) low = middle;
    else high = middle;
  }
  const angle = (low + high) / 2;
  const outerRadius = a + b * angle;
  // End at the lowest point with an exactly horizontal outward tangent.
  const phase = -Math.atan2(outerRadius, b) - angle;
  const segments = Math.min(4096, Math.max(128, Math.ceil(angle / 0.025)));
  const points = Array.from({ length: segments + 1 }, (_, i) => {
    const theta = angle * i / segments, phi = theta + phase, r = a + b * theta;
    const dx = b * Math.cos(phi) - r * Math.sin(phi);
    const dy = b * Math.sin(phi) + r * Math.cos(phi);
    const speed = Math.hypot(dx, dy);
    return { x: r * Math.cos(phi), y: r * Math.sin(phi), tx: dx / speed, ty: dy / speed, s: spiralLength(theta, a, b) };
  });
  const join = { ...points.at(-1), tx: 1, ty: 0, s: rolledLength };
  points[points.length - 1] = join;
  if (tailLength > 0) points.push({ ...join, x: join.x + tailLength, s: sheet.length });
  return { points, join, rolledLength, tailLength, turns: angle / TAU, outerRadius, pitch: b * TAU };
}
