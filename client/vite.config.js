import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const asyncMainCssPlugin = () => ({
  name: 'async-main-css',
  enforce: 'post',
  transformIndexHtml(html) {
    return html.replace(
      /<link rel="stylesheet"([^>]*href="\/assets\/index-[^"]+\.css"[^>]*)>/g,
      '<link rel="preload" as="style"$1 onload="this.onload=null;this.rel=\'stylesheet\'"><noscript><link rel="stylesheet"$1></noscript>',
    )
  },
})

// One document serves the whole site: app.html, the React shell. "/" included --
// it boots React, which redirects straight to the storefront home (/ae-en by
// default). There is no separate static landing page any more.
// In production Vercel does this routing (see vercel.json). This plugin does the
// same for `vite dev` and `vite preview`.
const appShellPlugin = () => {
  const middleware = (req, res, next) => {
    const [pathname, query = ''] = (req.url || '/').split('?')
    const isNavigation = req.method === 'GET' && (req.headers.accept || '').includes('text/html')

    // "/index.html" carries an extension but is still a navigation, so it has to
    // be allowed through alongside extensionless paths.
    const looksLikeFile = /\.[a-z0-9]+$/i.test(pathname) && pathname !== '/index.html'
    const isInternal = pathname.startsWith('/api') || pathname.startsWith('/@') || pathname.startsWith('/src/')
    if (isNavigation && !looksLikeFile && !isInternal) {
      req.url = '/app.html' + (query ? `?${query}` : '')
    }
    next()
  }

  return {
    name: 'app-shell-routing',
    configureServer(server) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware)
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), asyncMainCssPlugin(), appShellPlugin()],
  // No automatic fallback to index.html: the plugin above routes every
  // navigation, "/" included, to app.html.
  appType: 'mpa',
  server: {
    port: 3000,
    proxy: {
      '/ae-en/sitemap.xml': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/ae-ar/sitemap.xml': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/sitemap.xml': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Enable code splitting for better performance
    rollupOptions: {
      // The React shell, the only HTML entry point.
      input: path.resolve(__dirname, 'app.html'),
      output: {
        manualChunks: {
          // Vendor chunks - separate large libraries
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react', 'react-icons'],
          'vendor-forms': ['react-hook-form', 'react-select'],
          'vendor-utils': ['axios'],
        },
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Enable minification (using esbuild - faster and built-in)
    minify: 'esbuild',
    esbuild: {
      drop: ['console', 'debugger'], // Remove console.logs and debugger in production
    },
    // Enable source maps for debugging (disable in production if needed)
    sourcemap: false,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios'],
  },
})
