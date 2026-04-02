import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'electron-html-fix',
      transformIndexHtml: {
        enforce: 'post',
        transform(html) {
          // Electron loads via file:// — ES modules are blocked.
          // IIFE format + remove type="module" makes it a classic script.
          return html
            .replace(/ crossorigin/g, '')
            .replace(/<script type="module"/g, '<script defer')
        },
      },
    },
  ],
  build: {
    rollupOptions: {
      output: {
        format: 'iife',
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
})