import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {
        chunkSizeWarningLimit: 700,
        rollupOptions: {
            output: {
                manualChunks: {
                    'vendor-react': ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query', '@tanstack/react-virtual'],
                    'vendor-ui': [
                        '@radix-ui/react-context-menu',
                        '@radix-ui/react-dialog',
                        '@radix-ui/react-dropdown-menu',
                        '@radix-ui/react-select',
                        '@radix-ui/react-slider',
                        '@radix-ui/react-tooltip',
                        '@radix-ui/react-toast',
                        '@radix-ui/react-alert-dialog',
                        '@radix-ui/react-scroll-area',
                        '@radix-ui/react-progress',
                        'lucide-react',
                    ],
                    'vendor-pdf': ['pdfjs-dist', 'react-pdf'],
                    'vendor-syntax': ['react-syntax-highlighter'],
                },
            },
        },
    },
    server: {
        host: '0.0.0.0',
        port: 5030,
        allowedHosts: true,
        proxy: {
            '/api': {
                target: 'http://localhost:5031',
                changeOrigin: true,
            },
        },
    },
    preview: {
        host: '0.0.0.0',
        port: 5030,
        proxy: {
            '/api': {
                target: 'http://localhost:5031',
                changeOrigin: true,
            },
        },
    },
});
