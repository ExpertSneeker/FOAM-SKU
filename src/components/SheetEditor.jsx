import { DEFAULT_CONFIG, DEFAULT_SHEET, SHEET_LIMITS, toCentimeters, toDisplay } from '../config.js';
import { getRollLimits } from '../roll.js';
import { NumericInput, ParameterLabel, RangeControl, ResetButton } from './Controls.jsx';

export default function SheetEditor({ config: c, change }) {
  const s = c.sheet, unit = s.unit;
  const limits = getRollLimits(s, c.rollInnerDiameter);
  const update = patch => change(previous => ({ sheet: { ...previous.sheet, ...patch } }));
  return <div className="sheet-editor">
    <div className="stack-heading"><h2>半卷平铺</h2><span>单片 · 1 PC</span></div>
    <p className="stack-description">按一整片海绵的展开尺寸卷曲，卷宽沿卷轴方向。</p>
    <div className="unit-row"><span className="parameter-label"><span>单位</span><ResetButton label="单片单位" onReset={() => update({ unit: DEFAULT_SHEET.unit })} /></span><div className="segmented" aria-label="单片尺寸单位">{['in', 'cm'].map(value => <button type="button" key={value} aria-pressed={unit === value} onClick={() => update({ unit: value })}>{value}</button>)}</div></div>
    <div className="dimensions">{[['length', '展开总长度'], ['width', '卷宽'], ['thickness', '厚度']].map(([key, label]) => {
      const max = key === 'thickness' ? Math.min(SHEET_LIMITS.thickness[1], s.length / 16) : SHEET_LIMITS[key][1];
      return <div className="number-row" key={key}><ParameterLabel label={label} onReset={() => update({ [key]: DEFAULT_SHEET[key] })} /><div className="number-with-unit"><NumericInput label={label} value={toDisplay(s[key], unit)} min={toDisplay(SHEET_LIMITS[key][0], unit)} max={toDisplay(max, unit)} step={0.1} onChange={value => update({ [key]: toCentimeters(value, unit) })} /><span>{unit}</span></div></div>;
    })}</div>
    <div className="number-row"><ParameterLabel label="卷芯内径" onReset={() => change({ rollInnerDiameter: DEFAULT_CONFIG.rollInnerDiameter })} /><div className="number-with-unit"><NumericInput label="卷芯内径" value={toDisplay(c.rollInnerDiameter, unit)} min={toDisplay(limits.minDiameter, unit)} max={toDisplay(limits.maxDiameter, unit)} step={0.1} onChange={value => change({ rollInnerDiameter: toCentimeters(value, unit) })} /><span>{unit}</span></div></div>
    <RangeControl label="平铺伸出长度" value={toDisplay(c.rollTailLength, unit)} defaultValue={toDisplay(DEFAULT_CONFIG.rollTailLength, unit)} onChange={value => change({ rollTailLength: toCentimeters(value, unit) })} min={0} max={toDisplay(limits.maxTail, unit)} step={0.1} unit={unit} hint="伸出越长，卷体越小；卷起部分至少保留一圈。" />
    <div className="field-label"><ParameterLabel label="伸出方向" onReset={() => change({ rollSide: DEFAULT_CONFIG.rollSide })} /></div>
    <div className="roll-side" role="group" aria-label="伸出方向">{[['left', '向左伸出'], ['right', '向右伸出']].map(([value, label]) => <button type="button" key={value} aria-pressed={c.rollSide === value} onClick={() => change({ rollSide: value })}>{label}</button>)}</div>
    <p className="hint">方向以卷端正面为准，整体朝向可在下方旋转。</p>
    <RangeControl label="整体朝向" value={c.rollRotation} defaultValue={DEFAULT_CONFIG.rollRotation} onChange={rollRotation => change({ rollRotation })} min={0} max={360} step={1} unit="°" />
    <div className="roll-orientations" role="group" aria-label="朝向预设">{[0, 90, 180, 270].map(angle => <button type="button" key={angle} aria-pressed={c.rollRotation === angle} onClick={() => change({ rollRotation: angle })}>{angle}°</button>)}</div>
  </div>;
}
