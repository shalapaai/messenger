import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// API_TARGET используется в Docker (http://api:8080).
// При локальном запуске — по умолчанию http://localhost:8080.
const apiTarget = process.env.API_TARGET ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/hubs': {
        target: apiTarget.replace(/^http/, 'ws'),
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
