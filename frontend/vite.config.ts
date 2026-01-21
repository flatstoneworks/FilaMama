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
    server: {
        host: '0.0.0.0',
        port: 8010,
        allowedHosts: true,
        proxy: {
            '/api': {
                target: 'http://localhost:8011',
                changeOrigin: true,
            },
        },
    },
    preview: {
        host: '0.0.0.0',
        port: 1030,
        proxy: {
            '/api': {
                target: 'http://localhost:1031',
                changeOrigin: true,
            },
        },
    },
});
