import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  preview: { port: 4177, strictPort: false },
  server: {
    port: 5177,
    strictPort: false,
    proxy: { '/api': 'http://127.0.0.1:8787' },
  },
  test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
})
