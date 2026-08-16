import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // 0.0.0.0 para poder abrir la app desde el móvil en la misma Wi-Fi.
    host: true,
    port: 5173,
  },
});
