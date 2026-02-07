import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    host: true,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV !== 'production', // Source maps nur in Dev
    
    // Performance: Code Splitting für bessere Cache-Nutzung
    rollupOptions: {
      output: {
        // Manual Chunks für optimales Caching
        manualChunks: {
          // React Core (ändert sich selten)
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          
          // UI Components (Radix, Lucide Icons)
          'vendor-ui': ['lucide-react', 'react-hot-toast', 'clsx'],
          
          // State & Data Fetching
          'vendor-state': ['zustand', '@tanstack/react-query'],
          
          // Utilities (selten geändert)
          'vendor-utils': ['date-fns', 'axios'],
          
          // Payment (Stripe - kann separat gecacht werden)
          'vendor-payment': ['@stripe/react-stripe-js', '@stripe/stripe-js'],
          
          // WebRTC (PeerJS - groß, separat cachen)
          'vendor-webrtc': ['peerjs']
        },
        
        // Dateinamen mit Content Hash für langfristiges Caching
        chunkFileNames: 'assets/[name].[hash].js',
        entryFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    },
    
    // Performance: Chunk Size Warnings
    chunkSizeWarningLimit: 1000, // 1MB (Standard: 500KB)
    
    // Minification
    minify: 'esbuild', // Schneller als Terser
    target: 'es2020', // Modern Browsers (95%+ support)
    
    // CSS Code Splitting
    cssCodeSplit: true
  },
  
  // Performance: Dependency Pre-Bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'axios',
      'zustand',
      '@tanstack/react-query'
    ]
  }
});
