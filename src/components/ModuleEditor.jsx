import { useEffect, useRef, useState } from 'react';
import { DEFAULT_CONFIG, DEFAULT_MODULE, LIMITS, MAX_MODULES, PRESETS, STACK_ALIGNMENTS, prettyNumber, toCentimeters, toDisplay } from '../config.js';
import { Icon, NumericInput, ParameterLabel } from './Controls.jsx';

function ModuleCard({ module: m, index, total, update, remove, move }) {
  const [expanded, setExpanded] = useState(true);
  const preset = PRESETS.find(p => ['length', 'width', 'thickness', 'count'].every(key => Math.abs(p[key] - m[key]) < 0.0001));
  const presetId = `preset-${m.id}`;
  const bodyId = `module-body-${m.id}`;
  const dimensions = [m.length, m.width, m.thickness].map(value => prettyNumber(toDisplay(value, m.unit))).join(' × ');
  return <section className="module-card" role="group" aria-label={`海绵模块 ${index + 1}`} data-module-id={m.id}>
    <div className="module-header">
      <div className="module-title"><h3><button type="button" className="module-toggle" aria-label={`${expanded ? '折叠' : '展开'}模块 ${index + 1}`} aria-expanded={expanded} aria-controls={bodyId} onClick={() => setExpanded(value => !value)}><Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={13} />模块 {index + 1}</button></h3><span>{index === 0 ? '底层' : index === total - 1 ? '顶层' : '中层'}</span></div>
      <div className="module-actions">
        <button type="button" aria-label="往上放" title="往上放，靠近顶层" disabled={index === total - 1} onClick={() => move(1)}><Icon name="arrowUp" size={15} /></button>
        <button type="button" aria-label="往下放" title="往下放，靠近底层" disabled={index === 0} onClick={() => move(-1)}><Icon name="arrowDown" size={15} /></button>
        <button className="remove-module" aria-label="删除模块" title={total === 1 ? '至少保留一个模块' : '删除此模块'} disabled={total === 1} onClick={remove}><Icon name="trash" size={15} /></button>
      </div>
    </div>
    <p className="module-spec">{dimensions} {m.unit} · {m.count} 片</p>
    <div className="module-body" id={bodyId} hidden={!expanded}>
    <div className="field-label"><ParameterLabel label="预设尺寸" htmlFor={presetId} onReset={() => update({ length: DEFAULT_MODULE.length, width: DEFAULT_MODULE.width, thickness: DEFAULT_MODULE.thickness, count: DEFAULT_MODULE.count })} /></div>
    <select id={presetId} value={preset?.id || 'custom'} onChange={event => {
      const p = PRESETS.find(p => p.id === event.target.value);
      if (p) update({ length: p.length, width: p.width, thickness: p.thickness, count: p.count });
    }}><option value="custom">自定义尺寸</option>{PRESETS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select>
    <div className="unit-row"><ParameterLabel label="单位" onReset={() => update({ unit: DEFAULT_MODULE.unit })} /><div className="segmented" aria-label="尺寸单位">{['in', 'cm'].map(unit => <button key={unit} aria-pressed={m.unit === unit} onClick={() => update({ unit })}>{unit}</button>)}</div></div>
    <div className="dimensions">{[['length', '长度'], ['width', '宽度'], ['thickness', '单片厚度']].map(([key, label]) => <div className="number-row" key={key}><ParameterLabel label={label} onReset={() => update({ [key]: DEFAULT_MODULE[key] })} /><div className="number-with-unit"><NumericInput value={toDisplay(m[key], m.unit)} onChange={value => update({ [key]: toCentimeters(value, m.unit) })} min={toDisplay(LIMITS[key][0], m.unit)} max={toDisplay(LIMITS[key][1], m.unit)} step={0.1} label={label} /><span>{m.unit}</span></div></div>)}</div>
    <div className="number-row"><ParameterLabel label="片数" onReset={() => update({ count: DEFAULT_MODULE.count })} /><div className="stepper"><button aria-label="减少片数" disabled={m.count <= 1} onClick={() => update({ count: m.count - 1 })}><Icon name="minus" /></button><NumericInput value={m.count} onChange={count => update({ count })} label="片数" min={1} max={12} /><button aria-label="增加片数" disabled={m.count >= 12} onClick={() => update({ count: m.count + 1 })}><Icon name="plus" /></button></div></div>
    </div>
  </section>;
}

export default function ModuleEditor({ modules, alignment, change }) {
  const addedModule = useRef(null);
  const cards = useRef(null);
  useEffect(() => {
    if (addedModule.current) {
      // A tall card must reveal its title rather than align its bottom edge.
      cards.current?.firstElementChild?.scrollIntoView({ block: 'start' });
      addedModule.current = null;
    }
  }, [modules.length]);
  function update(id, patch) {
    change(previous => ({ modules: previous.modules.map(module => module.id === id ? { ...module, ...patch } : module) }));
  }
  function remove(id) {
    change(previous => ({ modules: previous.modules.length > 1 ? previous.modules.filter(module => module.id !== id) : previous.modules }));
  }
  function move(id, direction) {
    change(previous => {
      const next = [...previous.modules], from = next.findIndex(module => module.id === id), to = from + direction;
      if (from >= 0 && to >= 0 && to < next.length) [next[from], next[to]] = [next[to], next[from]];
      return { modules: next };
    });
  }
  function add() {
    const id = crypto.randomUUID();
    addedModule.current = id;
    change(previous => ({ modules: previous.modules.length < MAX_MODULES ? [...previous.modules, { ...previous.modules.at(-1), id, count: 1 }] : previous.modules }));
  }
  const count = modules.reduce((sum, module) => sum + module.count, 0);
  const height = modules.reduce((sum, module) => sum + module.thickness * module.count, 0);
  return <div className="module-editor">
    <div className="stack-heading"><h2>海绵堆叠</h2><span>{modules.length} 个模块 · {count} 片</span></div>
    <p className="stack-description">列表从顶层到底层排列，模块 1 在最底层。点击模块标题可展开或折叠。</p>
    <div className="stack-alignment">
      <div className="field-label"><ParameterLabel label="堆叠对齐" id="stack-alignment-label" onReset={() => change({ stackAlignment: DEFAULT_CONFIG.stackAlignment })} /></div>
      <div className="alignment-picker" role="group" aria-labelledby="stack-alignment-label">
        {STACK_ALIGNMENTS.map(item => <button type="button" key={item.id} aria-label={`${item.label}对齐`} aria-pressed={alignment === item.id} onClick={() => change({ stackAlignment: item.id })}>{item.label}</button>)}
      </div>
      <p className="hint">整组共用，按最大长宽对齐。前后左右以产品自身为准，不随镜头旋转。</p>
    </div>
    <div className="module-list" ref={cards}>{modules.map((module, index) => <ModuleCard key={module.id} module={module} index={index} total={modules.length} update={patch => update(module.id, patch)} remove={() => remove(module.id)} move={direction => move(module.id, direction)} />).reverse()}</div>
    <button className="add-module" disabled={modules.length >= MAX_MODULES} onClick={add}><Icon name="plus" />{modules.length >= MAX_MODULES ? `已达到 ${MAX_MODULES} 个模块` : '添加海绵模块'}</button>
    <p className="stack-summary">共 {count} 片 · 总高度 {prettyNumber(toDisplay(height, modules[0].unit))} {modules[0].unit}</p>
  </div>;
}
