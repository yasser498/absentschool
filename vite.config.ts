
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // This bridges the Vercel/System environment variable to the client-side code
      // We check for 'API_KEY' first, then fallback to 'VITE_GOOGLE_AI_KEY'
      // Fallback to empty string to ensure the code doesn't crash accessing undefined process.env
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_GOOGLE_AI_KEY || ''),
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
    server: {
      port: 5173,
      host: true
    }
  };
});
