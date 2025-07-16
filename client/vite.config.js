import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: [
      'all',
      'b3358a6025db.ngrok-free.app'  // 💥 bu satırı kendi linkine göre ekle
    ]
  }
})
