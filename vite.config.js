import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0, // Don't inline any assets into JS
    reportCompressedSize: false, // Speed up build
    rollupOptions: {
      output: {
        manualChunks: {
          // Split large libraries into separate chunks. @huggingface/transformers is
          // only imported from workers, so each worker bundle carries its own copy.
          react: ['react', 'react-dom', 'react-router-dom'],
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers'] // Don't pre-bundle this large library
  }
});