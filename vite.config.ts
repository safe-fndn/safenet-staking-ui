import path from "path"
import { defineConfig, type ViteDevServer, type PreviewServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const safeAppHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET",
  "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization",
  // Chrome's Private Network Access check: without this, a public origin
  // (e.g. https://app.safe.global) fetching a loopback address like
  // localhost is blocked even with a permissive Access-Control-Allow-Origin.
  "Access-Control-Allow-Private-Network": "true",
  "Content-Security-Policy": "frame-ancestors 'self' https://app.safe.global",
}

// Vite installs its own CORS middleware before plugin middlewares run (its
// `server.cors` default is an origin allowlist, not `false`, despite what
// the type docs say), which is why `cors: false` below is required — without
// it, Vite's own preflight response wins and never sees our custom headers.
// And `server.headers` isn't a blanket middleware; it's merged in only where
// Vite's static file serving explicitly threads it through, which an
// OPTIONS preflight never reaches — so this middleware has to set every
// header itself rather than relying on `headers` to cover OPTIONS too.
function respondToPreflight(server: ViteDevServer | PreviewServer) {
  server.middlewares.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      for (const [key, value] of Object.entries(safeAppHeaders)) {
        res.setHeader(key, value)
      }
      res.end()
      return
    }
    next()
  })
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'inject-app-url',
      transformIndexHtml: (html) =>
        html.replace(/%VITE_APP_URL%/g, process.env.VITE_APP_URL ?? ''),
    },
    {
      name: 'private-network-access-preflight',
      configureServer: respondToPreflight,
      configurePreviewServer: respondToPreflight,
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Disabled so our own preflight middleware (below) is what answers
    // OPTIONS requests — Vite's built-in CORS handling runs earlier and
    // would otherwise short-circuit the Private Network Access preflight
    // before our headers get set.
    cors: false,
    headers: safeAppHeaders,
  },
  preview: {
    cors: false,
    headers: safeAppHeaders,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (
            id.includes('@walletconnect/') ||
            id.includes('@reown/')
          ) {
            return 'vendor-walletconnect'
          }
          if (
            id.includes('@radix-ui/') ||
            id.includes('/class-variance-authority/') ||
            id.includes('/clsx/') ||
            id.includes('/tailwind-merge/')
          ) {
            return 'vendor-ui'
          }
        },
      },
    },
  },
})
