import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    strictPort: true,
    watch: {
      usePolling: true
    },
    proxy: {
      '/socket.io': {
        target: 'https://d29f3315a3cc.ngrok-free.app',
        ws: true,
        changeOrigin: true,
        secure: false
      }
    }
  }
})
