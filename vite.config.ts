import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  build: {
    rollupOptions: {
      output: {
        // React and the router change far less often than the product does, so
        // they are cached separately from the app chunk across deploys. The
        // Excel parser is already split out by its dynamic import.
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
