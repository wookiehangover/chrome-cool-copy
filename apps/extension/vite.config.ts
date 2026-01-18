import { defineConfig } from 'vite'
import { resolve } from 'path'
import { readdirSync } from 'fs'

// Plugin to copy static assets and wrap IIFE scripts
function copyAssetsPlugin() {
  return {
    name: 'copy-assets',
    apply: 'build',
    async closeBundle() {
      const fs = await import('fs/promises')
      const path = await import('path')

      // Copy HTML files (clip-viewer and clipped-pages removed - now using React viewer at apps/clips)
      const htmlFiles = [
        'src/pages/popup/popup.html',
        'src/pages/settings/settings.html',
      ]

      for (const file of htmlFiles) {
        try {
          const content = await fs.readFile(file, 'utf-8')
          const filename = path.basename(file)
          await fs.mkdir('dist/pages', { recursive: true })
          await fs.writeFile(`dist/pages/${filename}`, content)
        } catch (e) {
          console.warn(`Could not copy ${file}`)
        }
      }

      // Copy TTS player HTML
      try {
        const ttsHtml = await fs.readFile('src/tts-player/index.html', 'utf-8')
        await fs.mkdir('dist/tts-player', { recursive: true })
        await fs.writeFile('dist/tts-player/index.html', ttsHtml)
      } catch (e) {
        console.warn('Could not copy tts-player/index.html')
      }

      // Copy CSS files (clip-viewer and clipped-pages CSS removed - now using React viewer at apps/clips)
      const cssFiles = [
        'src/pages/popup/popup.css',
        'src/pages/settings/settings.css',
        'src/styles.css',
      ]

      for (const file of cssFiles) {
        try {
          const content = await fs.readFile(file, 'utf-8')
          const filename = path.basename(file)
          if (file.includes('pages')) {
            await fs.mkdir('dist/pages', { recursive: true })
            await fs.writeFile(`dist/pages/${filename}`, content)
          } else {
            await fs.writeFile(`dist/${filename}`, content)
          }
        } catch (e) {
          console.warn(`Could not copy ${file}`)
        }
      }

      // Copy vendor files
      try {
        const vendorFiles = readdirSync('vendor')
        await fs.mkdir('dist/vendor', { recursive: true })
        for (const file of vendorFiles) {
          const content = await fs.readFile(`vendor/${file}`)
          await fs.writeFile(`dist/vendor/${file}`, content)
        }
      } catch (e) {
        // vendor directory may not exist
      }

      // Copy icons
      try {
        const iconFiles = readdirSync('icons')
        await fs.mkdir('dist/icons', { recursive: true })
        for (const file of iconFiles) {
          const content = await fs.readFile(`icons/${file}`)
          await fs.writeFile(`dist/icons/${file}`, content)
        }
      } catch (e) {
        // icons directory may not exist
      }

      // Copy manifest
      try {
        const manifest = await fs.readFile('manifest.json', 'utf-8')
        await fs.writeFile('dist/manifest.json', manifest)
      } catch (e) {
        console.warn('Could not copy manifest.json')
      }

      // Wrap content.js in IIFE (Chrome content scripts need IIFE)
      try {
        let contentCode = await fs.readFile('dist/content.js', 'utf-8')
        contentCode = `(function() {\n${contentCode}\n})();`
        await fs.writeFile('dist/content.js', contentCode)
      } catch (e) {
        console.warn('Could not wrap content.js in IIFE')
      }

      // Wrap popup.js in IIFE
      try {
        let popupCode = await fs.readFile('dist/pages/popup.js', 'utf-8')
        popupCode = `(function() {\n${popupCode}\n})();`
        await fs.writeFile('dist/pages/popup.js', popupCode)
      } catch (e) {
        console.warn('Could not wrap popup.js in IIFE')
      }
    },
  }
}

export default defineConfig({
  plugins: [copyAssetsPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/index.ts'),
        background: resolve(__dirname, 'src/background.ts'),
        'services/database': resolve(__dirname, 'src/services/database.ts'),
        'services/local-clips': resolve(__dirname, 'src/services/local-clips.ts'),
        'services/clips-sync': resolve(__dirname, 'src/services/clips-sync.ts'),
        'pages/popup': resolve(__dirname, 'src/pages/popup/popup.ts'),
        // clip-viewer and clipped-pages removed - now using React viewer at apps/clips (outputs to dist/viewer)
        'pages/settings': resolve(__dirname, 'src/pages/settings/settings.ts'),
        'tts-player/index': resolve(__dirname, 'src/tts-player/main.ts'),
      },
      external: ['just-bash', 'just-bash/browser'],
      output: {
        dir: 'dist',
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: (chunkInfo) => {
          // Chrome extensions don't allow filenames starting with "_"
          // Vite generates __vite-browser-external chunks for Node.js modules
          // Also replace colons which can cause issues on some filesystems
          const name = chunkInfo.name || 'chunk';
          const sanitized = name.replace(/^_+/, 'x').replace(/:/g, '-');
          return `${sanitized}-[hash].js`;
        },
        // Sanitize all filenames to avoid underscore prefixes and colons
        sanitizeFileName: (name) => name.replace(/^_+/, 'x').replace(/:/g, '-'),
        // Force @repo/shared modules to be included in each entry that uses them
        // rather than being extracted to a shared chunk
        manualChunks: undefined,
      },
    },
  },
})

