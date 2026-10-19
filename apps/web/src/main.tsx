import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

/**
 * 部署后旧标签页里残留的 chunk 名会 404，Vite 抛 vite:preloadError，
 * 表现为页面卡在加载态。index.html 本身不缓存，刷新一次即可拿到新的 chunk 清单，
 * 所以这里自动刷新一次。用 sessionStorage 做 10 秒冷却，避免真的坏掉时无限刷新。
 */
const RELOAD_KEY = 'chunk-reload-at';
const RELOAD_COOLDOWN_MS = 10_000;

window.addEventListener('vite:preloadError', (event) => {
  const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
  if (Date.now() - last < RELOAD_COOLDOWN_MS) return;
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  event.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
