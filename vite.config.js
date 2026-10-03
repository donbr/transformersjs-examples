import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Same cross-origin isolation as vercel.json, so `vite` and `vite preview` run ONNX Runtime
// multi-threaded like the deployed site (single-threaded runs hide pthread-only bugs).
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [react()],
  server: { headers: isolationHeaders },
  preview: { headers: isolationHeaders },
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