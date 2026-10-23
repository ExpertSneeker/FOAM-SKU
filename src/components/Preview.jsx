import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Icon } from './Controls.jsx';
import { DEFAULT_CONFIG } from '../config.js';

function canvasBlob(canvas, format) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片编码失败，请降低分辨率后重试。')), format === 'jpeg' ? 'image/jpeg' : 'image/png', 0.96));
}

const Preview = forwardRef(function Preview({ config, change, busy, onReady, onError }, ref) {
  const canvas = useRef(null);
  const area = useRef(null);
  const engine = useRef(null);
  const abortPreview = useRef(null);
  const drag = useRef(null);
  const [size, setSize] = useState({ width: 600, height: 600 });
  const [status, setStatus] = useState('loading');
  const [initialized, setInitialized] = useState(false);
  const aspect = config.exportWidth / config.exportHeight;
  const displayWidth = Math.max(1, Math.floor(Math.min(size.width, size.height * aspect)));
  const displayHeight = Math.max(1, Math.floor(displayWidth / aspect));

  useEffect(() => {
    let disposed = false, instance;
    import('../render/StudioRenderer.js').then(({ StudioRenderer }) => {
      if (disposed) return;
      instance = new StudioRenderer(() => { setStatus('error'); onReady(false); onError('显卡渲染已中断，请刷新页面后降低导出分辨率。参数已保存在本机。'); });
      engine.current = instance; setInitialized(true);
    }).catch(() => { if (!disposed) { setStatus('error'); onError('无法初始化 3D 渲染，请使用开启硬件加速的 Chrome 或 Edge。'); } });
    return () => { disposed = true; abortPreview.current?.abort(); instance?.dispose(); };
  }, [onError, onReady]);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width), height = Math.floor(entry.contentRect.height);
      setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    });
    observer.observe(area.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!initialized || busy) return;
    const controller = new AbortController();
    abortPreview.current = controller;
    onReady(false);
    setStatus('rendering');
    const timer = setTimeout(() => {
      const scale = Math.min(window.devicePixelRatio || 1, 1.5, 1400 / Math.max(displayWidth, displayHeight));
      engine.current.render(config, canvas.current, Math.max(1, Math.round(displayWidth * scale)), Math.max(1, Math.round(displayHeight * scale)), 16, { signal: controller.signal })
        .then(() => { if (!controller.signal.aborted) { setStatus('ready'); onReady(true); } })
        .catch(error => { if (error.name !== 'AbortError') { setStatus('error'); onError(error.message); } });
    }, 75);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [config, initialized, displayWidth, displayHeight, busy, onReady, onError]);

  useImperativeHandle(ref, () => ({
    async exportImage(signal, onProgress) {
      abortPreview.current?.abort();
      const output = document.createElement('canvas');
      await engine.current.render(config, output, config.exportWidth, config.exportHeight, config.samples, { signal, onProgress });
      if (signal.aborted) throw new DOMException('已取消', 'AbortError');
      const blob = await canvasBlob(output, config.format);
      if (signal.aborted) throw new DOMException('已取消', 'AbortError');
      return blob;
    },
  }), [config]);

  function pointerDown(event) {
    if (busy || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, azimuth: config.azimuth, elevation: config.elevation };
  }
  function pointerMove(event) {
    if (!drag.current || busy) return;
    change({ azimuth: drag.current.azimuth + (event.clientX - drag.current.x) * 0.3, elevation: drag.current.elevation + (event.clientY - drag.current.y) * 0.25 });
  }
  function keyboard(event) {
    if (busy) return;
    const updates = { ArrowLeft: { azimuth: config.azimuth - 3 }, ArrowRight: { azimuth: config.azimuth + 3 }, ArrowUp: { elevation: config.elevation + 3 }, ArrowDown: { elevation: config.elevation - 3 }, '+': { framing: config.framing + 0.03 }, '=': { framing: config.framing + 0.03 }, '-': { framing: config.framing - 0.03 } };
    if (updates[event.key]) { event.preventDefault(); change(updates[event.key]); }
  }
  return <section className="preview-pane">
    <div className="preview-toolbar"><h1>实时预览</h1><div><button disabled={busy} onClick={() => change({ azimuth: DEFAULT_CONFIG.azimuth, elevation: DEFAULT_CONFIG.elevation, focalLength: DEFAULT_CONFIG.focalLength })}><Icon name="reset" />复位视角</button><button disabled={busy} onClick={() => change({ framing: DEFAULT_CONFIG.framing })}><Icon name="fit" />适合画布</button></div></div>
    <div className="canvas-area" ref={area}><div className={`scene-frame ${config.transparent ? 'checkerboard' : ''}`} style={{ width: displayWidth, height: displayHeight, backgroundColor: config.transparent ? undefined : config.background }}>
      <canvas ref={canvas} data-testid="preview" data-status={status} aria-label="海绵三维预览，拖动旋转，滚轮缩放" role="img" tabIndex="0" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onKeyDown={keyboard} onWheel={event => { if (!busy) change({ framing: config.framing - event.deltaY * 0.0004 }); }} />
      {status === 'loading' && <div className="canvas-message"><span className="spinner" />正在准备材质</div>}
      {status === 'error' && <div className="canvas-message">渲染暂不可用，请查看上方提示</div>}
    </div></div>
    <div className="preview-caption"><span>拖动旋转 · 滚轮缩放</span><span>{status === 'rendering' && !busy ? '正在更新预览…' : `透视 ${Math.round(config.elevation)}° · ${config.focalLength} mm`}</span></div>
  </section>;
});
export default Preview;
