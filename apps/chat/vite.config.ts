import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const isDevMode = process.env.VITE_DEV_MODE === 'true'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Build directly into the extension's dist/sidepanel directory
    outDir: '../extension/dist/sidepanel',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html',
      output: {
        // Use stable filenames without hashes for easier debugging
        entryFileNames: 'js/[name].js',
        chunkFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.')
          const ext = info[info.length - 1]
          if (/png|jpe?g|gif|tiff|bmp|ico/i.test(ext)) {
            return `images/[name]-[hash][extname]`
          } else if (/woff|woff2|ttf|otf|eot/i.test(ext)) {
            return `fonts/[name]-[hash][extname]`
          } else if (ext === 'css') {
            return `css/[name]-[hash][extname]`
          }
          return `[name]-[hash][extname]`
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    // Allow access from chrome-extension:// origins for dev mode
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    // Watch for changes and enable HMR
    watch: {
      usePolling: false,
    },
  },
})

