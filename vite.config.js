import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Relative asset paths so the build works when served from a sub-path
  // (e.g. Catalyst serves the web client under /app/).
  base: './',
  plugins: [react()],
  server: {
    // Honor the port assigned by the preview harness (PORT env); fall back to Vite's default.
    port: Number(process.env.PORT) || 5173,
  },
})
