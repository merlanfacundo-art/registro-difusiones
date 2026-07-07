import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuración estándar de Vite + React.
// El proxy de /api hacia el puerto de Vercel dev solo aplica si corrés
// `vercel dev` en paralelo; ver README para el flujo de desarrollo local.
export default defineConfig({
  plugins: [react()],
});
