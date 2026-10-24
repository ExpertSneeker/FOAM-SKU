import { useState } from 'react';
import { DEFAULT_CONFIG, FOAM_COLOR_PRESETS } from '../config.js';
import { ColorControl, RangeControl, Switch } from './Controls.jsx';
import ModuleEditor from './ModuleEditor.jsx';
import SheetEditor from './SheetEditor.jsx';

function ProductPanel({ config: c, change }) {
  return <>
    <span className="field-label">海绵形态</span>
    <div className="shape-picker" role="group" aria-label="海绵形态">{[['stack', '平板堆叠'], ['roll', '整卷'], ['partial', '半卷平铺']].map(([value, label]) => <button type="button" key={value} aria-pressed={c.shape === value} onClick={() => change({ shape: value })}>{label}</button>)}</div>
    {c.shape === 'stack' ? <ModuleEditor modules={c.modules} change={change} /> : <SheetEditor config={c} change={change} />}
    <hr />
    <RangeControl label="圆角半径" value={c.radius} onChange={radius => change({ radius })} min={0} max={20} step={0.1} unit="mm" hint="薄片的圆角会自动限制在厚度允许的范围内。" />
    <RangeControl label="细孔强度" value={c.poreStrength} onChange={poreStrength => change({ poreStrength })} min={0} max={2} />
    <RangeControl label="细孔大小" value={c.poreScale} onChange={poreScale => change({ poreScale })} min={0.3} max={3} unit="×" />
    <ColorControl label="表面颜色" value={c.foamColor} onChange={foamColor => change({ foamColor })} />
    <div className="foam-color-presets" role="group" aria-label="海绵颜色预设">
      {FOAM_COLOR_PRESETS.map(preset => <button type="button" key={preset.id} aria-pressed={c.foamColor === preset.color} onClick={() => change({ foamColor: preset.color })}>
        <span className="foam-color-swatch" style={{ backgroundColor: preset.color }} aria-hidden="true" />{preset.label}
      </button>)}
    </div>
    <details className="advanced"><summary>更多材质设置</summary><RangeControl label="表面粗糙度" value={c.roughness} onChange={roughness => change({ roughness })} min={0.6} max={1} /><RangeControl label="上缘深浅" value={c.edgeShade} onChange={edgeShade => change({ edgeShade })} min={0} max={0.06} step={0.001} /></details>
  </>;
}

function CameraPanel({ config: c, change }) {
  return <>
    <h2>透视镜头</h2><p className="panel-description">低角度展示厚度，保留自然透视。</p>
    <div className="view-presets"><button onClick={() => change({ azimuth: 31, elevation: DEFAULT_CONFIG.elevation })}>前右视角</button><button onClick={() => change({ azimuth: -31, elevation: DEFAULT_CONFIG.elevation })}>前左视角</button><button onClick={() => change({ azimuth: 0, elevation: 12 })}>接近正面</button><button onClick={() => change({ azimuth: 31, elevation: 45 })}>俯看细节</button></div>
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
