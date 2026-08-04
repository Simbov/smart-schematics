// Temporary config for scripts/buildAcsDemo.test.js (a generator, not a test).
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  test: { include: ['scripts/**/*.test.js'], environment: 'node' },
})
