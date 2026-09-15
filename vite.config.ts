import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // The app is served through Express middleware, which does not forward
      // Vite's WebSocket upgrade requests. Keep the injected Vite client from
      // opening a socket that can never complete its handshake.
      hmr: false,
      watch: null,
    },
  };
});
