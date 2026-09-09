import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Forwards to the Express API (server/index.ts, run separately via
    // `npm run server`) so client `fetch("/api/...")` calls work in dev
    // without CORS -- both origins look like one from the browser's side.
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  test: {
    // e2e/ holds Playwright specs, which use a different `test`/`expect`
    // than Vitest's -- without this, Vitest's default file discovery
    // matches them too (same *.spec.ts pattern) and tries to run them.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
