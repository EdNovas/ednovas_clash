// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // 告诉 Vite 主进程代码在哪里
        entry: 'electron/main.ts',
      },
    ]),
    renderer(),
  ],
})