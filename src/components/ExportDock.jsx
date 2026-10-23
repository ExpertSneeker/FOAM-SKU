import { Icon, NumericInput } from './Controls.jsx';

export default function ExportDock({ config: c, change, busy, ready, progress, onExport, onCancel }) {
  const format = c.format === 'jpeg' ? 'JPEG' : 'PNG';
  return <section className="export-dock" aria-label="导出图片"><div className="export-title"><h2>导出图片</h2><span>纯本地渲染</span></div>
    <fieldset className="export-settings" disabled={busy}>
      <label>格式<select aria-label="导出格式" value={c.format} onChange={event => change({ format: event.target.value })}><option value="png">PNG</option><option value="jpeg" disabled={c.transparent}>JPEG</option></select></label>
      <div className="resolution-control"><label htmlFor="resolution-preset">分辨率</label><div><select id="resolution-preset" value={c.exportWidth === c.exportHeight && [1024, 2000, 3000, 4096].includes(c.exportWidth) ? c.exportWidth : 'custom'} onChange={event => { if (event.target.value !== 'custom') change({ exportWidth: Number(event.target.value), exportHeight: Number(event.target.value) }); }}><option value="custom">自定义</option>{[1024, 2000, 3000, 4096].map(n => <option key={n} value={n}>{n} × {n}</option>)}</select><div className="pixel-inputs"><NumericInput value={c.exportWidth} onChange={exportWidth => change({ exportWidth })} label="导出宽度" min={256} max={4096} /><span>×</span><NumericInput value={c.exportHeight} onChange={exportHeight => change({ exportHeight })} label="导出高度" min={256} max={4096} /><span>px</span></div></div></div>
      <label>质量<select aria-label="渲染质量" value={c.samples} onChange={event => change({ samples: Number(event.target.value) })}><option value="16">快速 · 16 采样</option><option value="32">标准 · 32 采样</option><option value="48">精细 · 48 采样</option><option value="64">超细 · 64 采样</option></select></label>
    </fieldset>
    <div className="export-action">{busy ? <><button className="primary" disabled><span className="spinner" />渲染 {Math.round(progress * 100)}%</button><button className="text-button" onClick={onCancel}>取消导出</button></> : <><button className="primary" onClick={onExport} disabled={!ready}><Icon name="down" />导出 {format}</button><span>{c.transparent ? '透明背景 · PNG' : `${(c.exportWidth * c.exportHeight / 1000000).toFixed(1)} MP · ${format}`}</span></>}</div>
    {busy && <progress max="1" value={progress} aria-label="导出进度" />}
  </section>;
}
