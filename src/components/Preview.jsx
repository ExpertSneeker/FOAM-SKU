import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Icon } from './Controls.jsx';
import { DEFAULT_CONFIG, LIMITS } from '../config.js';
import { createFrameScheduler } from '../render/frameScheduler.js';

function canvasBlob(canvas, format) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('图片编码失败，请降低分辨率后重试。')), format === 'jpeg' ? 'image/jpeg' : 'image/png', 0.96));
}

const Preview = forwardRef(function Preview({ config, change, busy, onReady, onError }, ref) {
  const canvas = useRef(null);
  const area = useRef(null);
  const engine = useRef(null);
  const abortPreview = useRef(null);
  const drag = useRef(null);
  const frames = useRef(null);
  const interaction = useRef(null);
  const settleTimer = useRef(null);
  const [size, setSize] = useState({ width: 600, height: 600 });
  const [status, setStatus] = useState('loading');
  const [initialized, setInitialized] = useState(false);
  const [interactive, setInteractive] = useState(false);
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
    frames.current = createFrameScheduler(({ config: next, width, height }) => {
      try {
        engine.current.renderInteractive(next, canvas.current, width, height);
        // Commit once per frame, rather than re-rendering the inspector for every pointer event.
        change({ azimuth: next.azimuth, elevation: next.elevation, framing: next.framing });
        setStatus('interactive');
      } catch (error) {
        interaction.current = null;
        drag.current = null;
        clearTimeout(settleTimer.current);
        setInteractive(false);
        setStatus('error');
        onError(error.message);
      }
    });
    const finish = () => finishInteraction();
    window.addEventListener('blur', finish);
    return () => {
      frames.current.cancel();
      clearTimeout(settleTimer.current);
      window.removeEventListener('blur', finish);
    };
  }, [change, onError]);

  useEffect(() => {
    if (!initialized || busy || interactive) return;
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
  }, [config, initialized, displayWidth, displayHeight, busy, interactive, onReady, onError]);

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

  function queueInteraction(patch) {
    if (busy || !initialized) return;
    abortPreview.current?.abort();
    clearTimeout(settleTimer.current);
    const next = { ...(interaction.current ?? config) };
    for (const [key, value] of Object.entries(patch)) {
      const [min, max] = LIMITS[key];
      next[key] = Math.max(min, Math.min(max, value));
    }
    interaction.current = next;
    setInteractive(true);
    onReady(false);
    const scale = Math.min(1, 720 / Math.max(displayWidth, displayHeight));
    frames.current.schedule({ config: next, width: Math.max(1, Math.round(displayWidth * scale)), height: Math.max(1, Math.round(displayHeight * scale)) });
  }
  function finishInteraction() {
    if (!interaction.current) return;
    clearTimeout(settleTimer.current);
    // Flush the final pointer position before switching back to the still renderer.
    frames.current.flush();
    interaction.current = null;
    drag.current = null;
    setInteractive(false);
  }
  function pointerDown(event) {
    if (busy || !initialized || drag.current || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const view = interaction.current ?? config;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, azimuth: view.azimuth, elevation: view.elevation };
    queueInteraction({});
  }
  function pointerMove(event) {
    if (!drag.current || busy || event.pointerId !== drag.current.pointerId) return;
    queueInteraction({ azimuth: drag.current.azimuth - (event.clientX - drag.current.x) * 0.3, elevation: drag.current.elevation + (event.clientY - drag.current.y) * 0.25 });
  }
  function pointerUp(event) {
    if (!drag.current || event.pointerId !== drag.current.pointerId) return;
    pointerMove(event);
    finishInteraction();
  }
  function wheel(event) {
    if (busy || !initialized) return;
    queueInteraction({ framing: (interaction.current ?? config).framing - event.deltaY * 0.0004 });
    if (!drag.current) settleTimer.current = setTimeout(finishInteraction, 150);
  }
  function keyboard(event) {
    if (busy) return;
    const updates = { ArrowLeft: { azimuth: config.azimuth - 3 }, ArrowRight: { azimuth: config.azimuth + 3 }, ArrowUp: { elevation: config.elevation + 3 }, ArrowDown: { elevation: config.elevation - 3 }, '+': { framing: config.framing + 0.03 }, '=': { framing: config.framing + 0.03 }, '-': { framing: config.framing - 0.03 } };
    if (updates[event.key]) { event.preventDefault(); change(updates[event.key]); }
  }
  return <section className="preview-pane">
    <div className="preview-toolbar"><h1>实时预览</h1><div><button disabled={busy} onClick={() => change({ azimuth: DEFAULT_CONFIG.azimuth, elevation: DEFAULT_CONFIG.elevation, focalLength: DEFAULT_CONFIG.focalLength })}><Icon name="reset" />复位视角</button><button disabled={busy} onClick={() => change({ framing: DEFAULT_CONFIG.framing })}><Icon name="fit" />适合画布</button></div></div>
    <div className="canvas-area" ref={area}><div className={`scene-frame ${config.transparent ? 'checkerboard' : ''}`} style={{ width: displayWidth, height: displayHeight, backgroundColor: config.transparent ? undefined : config.background }}>
      <canvas ref={canvas} data-testid="preview" data-status={status} data-quality={interactive ? 'interactive' : 'full'} aria-label="海绵三维预览，拖动旋转，滚轮缩放" role="img" tabIndex="0" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={finishInteraction} onLostPointerCapture={finishInteraction} onKeyDown={keyboard} onWheel={wheel} />
      {status === 'loading' && <div className="canvas-message"><span className="spinner" />正在准备材质</div>}
      {status === 'error' && <div className="canvas-message">渲染暂不可用，请查看上方提示</div>}
    </div></div>
    <div className="preview-caption"><span>拖动旋转 · 滚轮缩放</span><span>{interactive ? '流畅预览 · 停止操作后恢复清晰' : status === 'rendering' && !busy ? '正在更新预览…' : `透视 ${Math.round(config.elevation)}° · ${config.focalLength} mm`}</span></div>
  </section>;
});
export default Preview;
