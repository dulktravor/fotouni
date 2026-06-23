import { defineConfig } from 'vite';

export default defineConfig({
  base: '/fotouni/', // Set the base path for GitHub Pages deployment
  server: {
    host: true,        // Allow connections from local network (IP address)
    port: 5173         // Set development server port
  }
});
