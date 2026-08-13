import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/auth': { target: 'http://localhost:8000', changeOrigin: true },
      '/users': { target: 'http://localhost:8000', changeOrigin: true },
      '/students': { target: 'http://localhost:8000', changeOrigin: true },
      '/staff': { target: 'http://localhost:8000', changeOrigin: true },
      '/departments': { target: 'http://localhost:8000', changeOrigin: true },
      '/categories': { target: 'http://localhost:8000', changeOrigin: true },
      '/facilities': { target: 'http://localhost:8000', changeOrigin: true },
      '/transport': { target: 'http://localhost:8000', changeOrigin: true },
      '/health': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
