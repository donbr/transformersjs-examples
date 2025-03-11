import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022', // Allow top-level await in workers
    assetsInlineLimit: 0, // Don't inline any assets into JS
    reportCompressedSize: false, // Speed up build
    rollupOptions: {
      output: {
        manualChunks: {
          // Split large libraries into separate chunks
          react: ['react', 'react-dom', 'react-router-dom'],
          transformers: ['@huggingface/transformers'],
        }
      }
    }
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers'] // Don't pre-bundle this large library
  }
});