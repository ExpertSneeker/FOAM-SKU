import { useCallback, useEffect, useRef, useState } from 'react';
import { exportFilename, loadSavedConfig, normalizeConfig, parseConfig, STORAGE_KEY } from './config.js';
import Inspector from './components/Inspector.jsx';
import Preview from './components/Preview.jsx';
import ExportDock from './components/ExportDock.jsx';

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export default function App() {
  const [config, setConfig] = useState(loadSavedConfig);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(null);
  const preview = useRef(null), fileInput = useRef(null), controller = useRef(null);
  const change = useCallback(patch => setConfig(previous => normalizeConfig({ ...previous, ...(typeof patch === 'function' ? patch(previous) : patch) })), []);
  const reportError = useCallback(text => setMessage({ text, error: true }), []);
  useEffect(() => {
    const timer = setTimeout(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { setMessage({ text: '浏览器禁止自动保存，可以使用“保存参数”下载配置。', error: true }); } }, 250);
    return () => clearTimeout(timer);
  }, [config]);
  useEffect(() => { if (message && !message.error) { const timer = setTimeout(() => setMessage(null), 4500); return () => clearTimeout(timer); } }, [message]);
  useEffect(() => () => controller.current?.abort(), []);

  async function importConfig(event) {
    const file = event.target.files[0]; event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 65536) throw new Error('参数文件不能超过 64 KB。');
      setConfig(parseConfig(await file.text())); setMessage({ text: '参数已导入。' });
    } catch (error) { reportError(error.message); }
  }
  async function exportImage() {
    setBusy(true); setProgress(0); setMessage(null);
    const abort = new AbortController(); controller.current = abort;
    try {
      const blob = await preview.current.exportImage(abort.signal, setProgress);
      if (!abort.signal.aborted) { download(blob, exportFilename(config)); setMessage({ text: `已导出 ${config.exportWidth} × ${config.exportHeight} px 图片。` }); }
    } catch (error) { if (error.name === 'AbortError') setMessage({ text: '已取消导出。' }); else reportError(error.message); }
    finally { setBusy(false); controller.current = null; }
  }
  return <div className="app-shell">
    <header className="app-header"><div className="brand"><span className="brand-mark" aria-hidden="true" /><span>FOAM SKU</span><span className="brand-description">海绵渲染工作台</span></div><div className="header-actions"><button disabled={busy} onClick={() => fileInput.current.click()}>导入参数</button><button disabled={busy} className="primary" onClick={() => download(new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }), 'foam-sku-config.json')}>保存参数</button><input hidden type="file" accept=".json,application/json" aria-label="导入参数文件" ref={fileInput} onChange={importConfig} /></div></header>
    {message && <div className={`notification ${message.error ? 'error' : ''}`} role={message.error ? 'alert' : 'status'}><span>{message.text}</span><button aria-label="关闭提示" onClick={() => setMessage(null)}>×</button></div>}
    <main className="studio"><Inspector config={config} change={change} busy={busy} /><div className="workspace"><Preview ref={preview} config={config} change={change} busy={busy} onReady={setReady} onError={reportError} /><ExportDock config={config} change={change} busy={busy} ready={ready} progress={progress} onExport={exportImage} onCancel={() => controller.current?.abort()} /></div></main>
  </div>;
}
