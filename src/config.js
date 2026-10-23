export const STORAGE_KEY = 'foam-sku:config:v1';
export const DEFAULT_CONFIG = Object.freeze({
  version: 1, unit: 'in', length: 60.96, width: 60.96, thickness: 10.16, count: 2,
  radius: 2.8, foamColor: '#ffffff', poreScale: 1, poreStrength: 0.8, roughness: 0.98, edgeShade: 0.008,
  azimuth: 31, elevation: 22, focalLength: 65, framing: 0.82,
  background: '#ffffff', transparent: false, shadow: true, shadowOpacity: 0.11, shadowSoftness: 1.3,
  lighting: 1, topLight: 0.24, exportWidth: 2000, exportHeight: 2000, samples: 48, format: 'png',
});

export const LIMITS = Object.freeze({
  length: [1, 400], width: [1, 400], thickness: [0.2, 80], count: [1, 12], radius: [0, 20],
  poreScale: [0.3, 3], poreStrength: [0, 2], roughness: [0.6, 1], edgeShade: [0, 0.06],
  azimuth: [-180, 180], elevation: [5, 85], focalLength: [28, 120], framing: [0.35, 0.94],
  shadowOpacity: [0, 0.5], shadowSoftness: [0, 2.5], lighting: [0.5, 1.4], topLight: [0, 0.8],
  exportWidth: [256, 4096], exportHeight: [256, 4096],
});

export const PRESETS = [
  { id: 'pair', label: '24 × 24 × 4 in · 2 PCS', length: 60.96, width: 60.96, thickness: 10.16, count: 2 },
  { id: 'square-thin', label: '24 × 24 × 2 in · 1 PC', length: 60.96, width: 60.96, thickness: 5.08, count: 1 },
  { id: 'square-thick', label: '24 × 24 × 6 in · 1 PC', length: 60.96, width: 60.96, thickness: 15.24, count: 1 },
  { id: 'long', label: '118 × 30 × 3 in · 1 PC', length: 299.72, width: 76.2, thickness: 7.62, count: 1 },
  { id: 'medium', label: '72 × 30 × 2 in · 1 PC', length: 182.88, width: 76.2, thickness: 5.08, count: 1 },
];

export function normalizeConfig(input = {}) {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const result = { ...DEFAULT_CONFIG };
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    if (typeof value[key] === 'number' && Number.isFinite(value[key])) result[key] = Math.max(min, Math.min(max, value[key]));
  }
  for (const key of ['count', 'exportWidth', 'exportHeight']) result[key] = Math.round(result[key]);
  for (const key of ['transparent', 'shadow']) if (typeof value[key] === 'boolean') result[key] = value[key];
  for (const key of ['background', 'foamColor']) {
    if (typeof value[key] === 'string' && /^#[0-9a-f]{6}$/i.test(value[key])) result[key] = value[key].toLowerCase();
  }
  if (value.unit === 'cm') result.unit = 'cm';
  if ([16, 32, 48, 64].includes(value.samples)) result.samples = value.samples;
  if (value.format === 'jpeg' && !result.transparent) result.format = 'jpeg';
  return result;
}

export function parseConfig(text) {
  if (typeof text !== 'string' || text.length > 65536) throw new Error('参数文件不能超过 64 KB。');
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('无法读取 JSON，请选择从本工具保存的参数文件。'); }
  if (!value || Array.isArray(value) || typeof value !== 'object' || value.version !== 1) {
    throw new Error('不是支持的 FOAM SKU 参数文件（版本 1）。');
  }
  return normalizeConfig(value);
}

export const toDisplay = (cm, unit) => unit === 'in' ? cm / 2.54 : cm;
export const toCentimeters = (value, unit) => unit === 'in' ? value * 2.54 : value;
export const prettyNumber = value => Number(value.toFixed(3)).toString();
export function exportFilename(config) {
  const dimensions = [config.length, config.width, config.thickness].map(n => prettyNumber(toDisplay(n, config.unit))).join('x');
  return `foam_${dimensions}${config.unit}_${config.count}pcs_${config.exportWidth}x${config.exportHeight}${config.transparent ? '_alpha' : ''}.${config.format === 'jpeg' ? 'jpg' : 'png'}`;
}

export function loadSavedConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? parseConfig(saved) : { ...DEFAULT_CONFIG };
  } catch { return { ...DEFAULT_CONFIG }; }
}
