import { readFileSync } from "fs"
import path from "path"
import { defineConfig, loadEnv, normalizePath, type Plugin, type ViteDevServer, type PreviewServer } from 'vite'
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

// Legal links: VITE_<KEY>_URL is either a full URL or #anchor (linked as-is) or a
// path to an HTML fragment file, which is inlined at build time and served at the
// matching route (e.g. #/terms). The content is trusted deployer input (like the
// env vars themselves), so it is not sanitized.
function legalPages(): Plugin {
  const legalFiles: string[] = []

  const loadLegalPage = (env: Record<string, string>, key: string) => {
    const value = env[`VITE_${key}_URL`]
    if (!value) return { url: "", html: "" }
    if (value.startsWith("#") || URL.canParse(value)) return { url: value, html: "" }
    const file = path.resolve(process.cwd(), value)
    // Normalized so it matches the watcher's paths on Windows
    legalFiles.push(normalizePath(file))
    try {
      return { url: "", html: readFileSync(file, "utf8") }
    } catch (error) {
      throw new Error(`VITE_${key}_URL is neither a full URL nor a readable file: ${file} (${(error as Error).message})`)
    }
  }

  return {
    name: 'legal-pages',
    config: (_, { mode }) => {
      const env = loadEnv(mode, process.cwd())
      legalFiles.length = 0
      const define: Record<string, string> = {}
      for (const key of ["TERMS", "PRIVACY", "IMPRINT"]) {
        const { url, html } = loadLegalPage(env, key)
        define[`__${key}_URL__`] = JSON.stringify(url)
        // Inlined legal page HTML — empty unless VITE_<KEY>_URL is a file path
        define[`__${key}_HTML__`] = JSON.stringify(html)
      }
      return { define }
    },
    // Legal page content is inlined via `define`, so restart the dev server when a file changes.
    configureServer: (server) => {
      server.watcher.add(legalFiles)
      server.watcher.on('change', (file) => {
        if (legalFiles.includes(normalizePath(file))) {
          void server.restart()
        }
      })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    legalPages(),
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
