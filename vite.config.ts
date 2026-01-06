import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  root: 'src/react',
  publicDir: 'assets',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src/react/index.html')
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3001,
    open: true,
    proxy: {
      '/h/rate-limit-check': {
        target: 'https://posthook.app',
        changeOrigin: true,
      },
      '/h/': {
        target: 'https://posthook.app',
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying
      },
      '/post/': {
        target: 'https://posthook.app',
        changeOrigin: true,
      },
      '/events': {
        target: 'https://posthook.app',
        changeOrigin: true,
      },
      '/trace/': {
        target: 'https://posthook.app',
        changeOrigin: true,
      }
    }
  }
})


