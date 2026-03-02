import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const safeAppHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET",
  "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization",
  "Content-Security-Policy": "frame-ancestors 'self' https://app.safe.global",
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    headers: safeAppHeaders,
  },
  preview: {
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
