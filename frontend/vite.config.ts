import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Mirrors Caddy's production reverse_proxy (LAUNCH_CHECKLIST.md Phase 5):
    // the browser only ever talks to :5173, so the backend is same-origin
    // and there's nothing for CORS to do locally either.
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
