import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true, // listen on 0.0.0.0 so the Vite dev server is reachable from inside the Docker container
    port: 5173,
    strictPort: true,
    watch: {
      // Docker Desktop's bind mounts on Windows/macOS don't reliably forward
      // inotify events into the container, so native file-watching silently
      // misses edits. Polling trades a little CPU for HMR you can trust.
      usePolling: true,
      interval: 300,
    },
  },
})
