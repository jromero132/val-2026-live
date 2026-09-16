import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api-val': {
        target: 'https://resultat.val.se',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-val/, ''),
      },
    },
  },
})
