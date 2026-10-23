import { useState } from 'react';
import { DEFAULT_CONFIG, LIMITS, PRESETS, toCentimeters, toDisplay } from '../config.js';
import { ColorControl, Icon, NumericInput, RangeControl, Switch } from './Controls.jsx';

function ProductPanel({ config: c, change }) {
  const preset = PRESETS.find(p => ['length', 'width', 'thickness', 'count'].every(key => Math.abs(p[key] - c[key]) < 0.0001));
  return <>
    <label className="field-label" htmlFor="sku-preset">预设尺寸</label>
    <select id="sku-preset" value={preset?.id || 'custom'} onChange={event => { const p = PRESETS.find(p => p.id === event.target.value); if (p) change(p); }}>
      <option value="custom">自定义尺寸</option>{PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
    </select>
    <div className="unit-row"><span>单位</span><div className="segmented" aria-label="尺寸单位">{['in', 'cm'].map(unit => <button key={unit} aria-pressed={c.unit === unit} onClick={() => change({ unit })}>{unit}</button>)}</div></div>
    <div className="dimensions">{[['length', '长度'], ['width', '宽度'], ['thickness', '单片厚度']].map(([key, label]) => <div className="number-row" key={key}><span>{label}</span><div className="number-with-unit"><NumericInput value={toDisplay(c[key], c.unit)} onChange={value => change({ [key]: toCentimeters(value, c.unit) })} min={toDisplay(LIMITS[key][0], c.unit)} max={toDisplay(LIMITS[key][1], c.unit)} step={0.1} label={label} /><span>{c.unit}</span></div></div>)}</div>
    <div className="number-row"><span>片数</span><div className="stepper"><button aria-label="减少片数" disabled={c.count <= 1} onClick={() => change({ count: c.count - 1 })}><Icon name="minus" /></button><NumericInput value={c.count} onChange={count => change({ count })} label="片数" min={1} max={12} /><button aria-label="增加片数" disabled={c.count >= 12} onClick={() => change({ count: c.count + 1 })}><Icon name="plus" /></button></div></div>
    <p className="hint align-right">多片完全对齐、贴合堆叠</p>
    <hr />
    <RangeControl label="圆角半径" value={c.radius} onChange={radius => change({ radius })} min={0} max={20} step={0.1} unit="mm" hint="薄片的圆角会自动限制在厚度允许的范围内。" />
    <RangeControl label="细孔强度" value={c.poreStrength} onChange={poreStrength => change({ poreStrength })} min={0} max={2} />
    <RangeControl label="细孔大小" value={c.poreScale} onChange={poreScale => change({ poreScale })} min={0.3} max={3} unit="×" />
    <ColorControl label="表面颜色" value={c.foamColor} onChange={foamColor => change({ foamColor })} />
    <details className="advanced"><summary>更多材质设置</summary><RangeControl label="表面粗糙度" value={c.roughness} onChange={roughness => change({ roughness })} min={0.6} max={1} /><RangeControl label="上缘深浅" value={c.edgeShade} onChange={edgeShade => change({ edgeShade })} min={0} max={0.06} step={0.001} /></details>
  </>;
}

function CameraPanel({ config: c, change }) {
  return <>
    <h2>透视镜头</h2><p className="panel-description">低角度展示厚度，保留自然透视。</p>
    <div className="view-presets"><button onClick={() => change({ azimuth: 31, elevation: 22 })}>前右视角</button><button onClick={() => change({ azimuth: -31, elevation: 22 })}>前左视角</button><button onClick={() => change({ azimuth: 0, elevation: 12 })}>接近正面</button><button onClick={() => change({ azimuth: 31, elevation: 45 })}>俯看细节</button></div>
    <hr />
    <RangeControl label="仰角" value={c.elevation} onChange={elevation => change({ elevation })} min={5} max={85} step={1} unit="°" />
    <RangeControl label="方位角" value={c.azimuth} onChange={azimuth => change({ azimuth })} min={-180} max={180} step={1} unit="°" />
    <RangeControl label="镜头焦距" value={c.focalLength} onChange={focalLength => change({ focalLength })} min={28} max={120} step={1} unit="mm" hint="数值越小，近大远小越明显。" />
    <RangeControl label="画面占比" value={c.framing} onChange={framing => change({ framing })} min={0.35} max={0.94} />
    <p className="panel-description">在预览中拖动旋转、滚轮缩放。也可用方向键旋转、+ / − 调整画面占比。</p>
  </>;
}

function ScenePanel({ config: c, change }) {
  return <>
    <h2>背景与阴影</h2>
    <Switch label="透明背景" checked={c.transparent} onChange={transparent => change({ transparent })} hint="棋盘格只用于预览，导出 PNG 保留透明通道。" />
    <ColorControl label="背景颜色" value={c.background} disabled={c.transparent} onChange={background => change({ background })} />
    <div className="swatches" aria-label="背景预设">{['#ffffff', '#f0f2f1', '#e6dfd4', '#25332e'].map(color => <button key={color} aria-label={`背景 ${color}`} title={color} style={{ background: color }} onClick={() => change({ background: color, transparent: false })} />)}</div>
    <hr />
    <Switch label="地面阴影" checked={c.shadow} onChange={shadow => change({ shadow })} />
    <fieldset disabled={!c.shadow}><RangeControl label="阴影浓度" value={c.shadowOpacity} onChange={shadowOpacity => change({ shadowOpacity })} min={0} max={0.5} /><RangeControl label="阴影柔和度" value={c.shadowSoftness} onChange={shadowSoftness => change({ shadowSoftness })} min={0} max={2.5} step={0.05} /></fieldset>
    <hr />
    <h2>摄影棚灯光</h2>
    <RangeControl label="整体亮度" value={c.lighting} onChange={lighting => change({ lighting })} min={0.5} max={1.4} />
    <RangeControl label="顶部补光" value={c.topLight} onChange={topLight => change({ topLight })} min={0} max={0.8} hint="默认顶面接近白色，与白底仍有轻微区分。" />
  </>;
}

export default function Inspector({ config, change, busy }) {
  const [tab, setTab] = useState('产品');
  return <aside className="inspector"><div className="tabs" role="tablist" aria-label="参数分组">{['产品', '视角', '场景'].map(label => <button id={`tab-${label}`} key={label} role="tab" aria-selected={tab === label} aria-controls="inspector-panel" onClick={() => setTab(label)}>{label}</button>)}</div>
    <div className="inspector-scroll" id="inspector-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}><fieldset disabled={busy}>{tab === '产品' ? <ProductPanel config={config} change={change} /> : tab === '视角' ? <CameraPanel config={config} change={change} /> : <ScenePanel config={config} change={change} />}</fieldset></div>
    <div className="inspector-footer"><span><i />参数自动保存</span><button disabled={busy} className="text-button" onClick={() => change(DEFAULT_CONFIG)}>恢复默认</button></div>
  </aside>;
}
