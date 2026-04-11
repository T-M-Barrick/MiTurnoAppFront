import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Puerto 5501 para desarrollo local
    port: 5501,
    host: '127.0.0.1',
    proxy: {
      // Todas las rutas del back se redirigen al servidor FastAPI
      // Esto hace que front y back compartan el mismo origen → las cookies funcionan sin problemas
      '/auth':        { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/usuarios':    { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/empresa':     { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/sucursal':    { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/invitaciones':{ target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/geo':         { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
})
