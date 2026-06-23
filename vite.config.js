import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true, // Allow connections from local network (IP address)
    port: 5173  // Set development server port
  }
});
