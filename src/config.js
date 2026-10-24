export const STORAGE_KEY = 'foam-sku:config:v2';
export const LEGACY_STORAGE_KEY = 'foam-sku:config:v1';
export const MAX_MODULES = 12;
export const DEFAULT_MODULE = Object.freeze({ id: 'module-1', unit: 'in', length: 60.96, width: 60.96, thickness: 10.16, count: 2 });
export const DEFAULT_CONFIG = Object.freeze({
  version: 2, modules: Object.freeze([DEFAULT_MODULE]),
  radius: 0.7, foamColor: '#ffffff', poreScale: 0.66, poreStrength: 0, roughness: 0.98, edgeShade: 0.008,
  azimuth: 31, elevation: 11, focalLength: 65, framing: 0.84,
  background: '#ffffff', transparent: false, shadow: true, shadowOpacity: 0.11, shadowSoftness: 1.3,
  lighting: 1.02, topLight: 0.32, exportWidth: 2000, exportHeight: 2000, samples: 64, format: 'png',
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

export const FOAM_COLOR_PRESETS = [
  { id: 'white', label: '白色', color: '#ffffff' },
  { id: 'yellow', label: '黄色', color: '#fff58c' },
];

export function normalizeConfig(input = {}) {
  const value = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const result = { ...DEFAULT_CONFIG };
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    if (Object.hasOwn(DEFAULT_CONFIG, key) && typeof value[key] === 'number' && Number.isFinite(value[key])) result[key] = Math.max(min, Math.min(max, value[key]));
  }
  for (const key of ['exportWidth', 'exportHeight']) result[key] = Math.round(result[key]);
  for (const key of ['transparent', 'shadow']) if (typeof value[key] === 'boolean') result[key] = value[key];
  for (const key of ['background', 'foamColor']) {
    if (typeof value[key] === 'string' && /^#[0-9a-f]{6}$/i.test(value[key])) result[key] = value[key].toLowerCase();
  }
  // Missing modules means a legacy single-size stack. Keep all its dimensions.
  const modules = Array.isArray(value.modules) && value.modules.length ? value.modules.slice(0, MAX_MODULES) : [value];
  const ids = new Set();
  result.modules = modules.map((item, index) => {
    const source = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
    const module = { ...DEFAULT_MODULE, unit: source.unit === 'cm' ? 'cm' : 'in' };
    for (const key of ['length', 'width', 'thickness', 'count']) {
      const [min, max] = LIMITS[key];
      if (typeof source[key] === 'number' && Number.isFinite(source[key])) module[key] = Math.max(min, Math.min(max, source[key]));
    }
    module.count = Math.round(module.count);
    let id = typeof source.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(source.id) ? source.id : `module-${index + 1}`;
    let suffix = 1;
    while (ids.has(id)) id = `module-${index + 1}-${suffix++}`;
    ids.add(id);
    return { ...module, id };
  });
  if ([16, 32, 48, 64].includes(value.samples)) result.samples = value.samples;
  if (value.format === 'jpeg' && !result.transparent) result.format = 'jpeg';
  return result;
}

export function parseConfig(text) {
  if (typeof text !== 'string' || text.length > 65536) throw new Error('参数文件不能超过 64 KB。');
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('无法读取 JSON，请选择从本工具保存的参数文件。'); }
  if (!value || Array.isArray(value) || typeof value !== 'object' || ![1, 2].includes(value.version)) {
    throw new Error('不是支持的 FOAM SKU 参数文件（版本 1 或 2）。');
  }
  if (value.version === 2 && (!Array.isArray(value.modules) || value.modules.length < 1 || value.modules.length > MAX_MODULES || value.modules.some(module => !module || typeof module !== 'object' || Array.isArray(module)))) throw new Error(`参数文件需要包含 1–${MAX_MODULES} 个海绵模块。`);
  return normalizeConfig(value);
}

export const toDisplay = (cm, unit) => unit === 'in' ? cm / 2.54 : cm;
export const toCentimeters = (value, unit) => unit === 'in' ? value * 2.54 : value;
export const prettyNumber = value => Number(value.toFixed(3)).toString();
export const moduleDimensions = module => [module.length, module.width, module.thickness].map(n => prettyNumber(toDisplay(n, module.unit))).join('x');
export function exportFilename(config) {
  const modules = config.modules;
  const count = modules.reduce((sum, module) => sum + module.count, 0);
  const details = modules.map(module => `${moduleDimensions(module)}${module.unit}-${module.count}pcs`).join('_');
  const product = modules.length === 1 ? `${moduleDimensions(modules[0])}${modules[0].unit}` : `stack_${details.length <= 120 ? details : `${modules.length}modules`}`;
  return `foam_${product}_${count}pcs_${config.exportWidth}x${config.exportHeight}${config.transparent ? '_alpha' : ''}.${config.format === 'jpeg' ? 'jpg' : 'png'}`;
}

export function loadSavedConfig(storage) {
  try { storage ??= globalThis.localStorage; } catch { return normalizeConfig(); }
  for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY]) {
    try {
      const saved = storage?.getItem(key);
      if (saved) return parseConfig(saved);
    } catch { /* Try the previous version before falling back to defaults. */ }
  }
  return normalizeConfig();
}
