import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // e2e/ holds Playwright specs, which use a different `test`/`expect`
    // than Vitest's -- without this, Vitest's default file discovery
    // matches them too (same *.spec.ts pattern) and tries to run them.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
