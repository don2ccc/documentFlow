/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:3000' } },
  build: {
    // 最大的按需 chunk 是 ~1.2 MB（react-pdf + xlsx + mammoth 的共享包），
    // 只在打开文档详情页时才下载。这里把阈值设到它之上，避免每次构建都刷警告。
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        // 只固定 react 三件套（体积小、几乎永不变）。
        //
        // antd 刻意不放进手动分包：实测把它整体拆成一个 chunk 后，首屏会被
        // modulepreload 拽下全部 1.3 MB antd；交给 Rollup 按引用关系自动拆，
        // 首屏只需下载真正用到的那部分（810 KB vs 1432 KB）。
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom']
        }
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts']
  }
});
