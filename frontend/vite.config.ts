import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const chunkMatchers: Array<[string, string[]]> = [
    ['vendor-react', [
        '/node_modules/react/',
        '/node_modules/react-dom/',
        '/node_modules/react-router/',
        '/node_modules/react-router-dom/',
        '/node_modules/@tanstack/',
    ]],
    ['vendor-ui', [
        '/node_modules/@radix-ui/',
        '/node_modules/lucide-react/',
        '/node_modules/@flatstoneworks/ui/',
    ]],
    ['vendor-pdf', [
        '/node_modules/pdfjs-dist/',
        '/node_modules/react-pdf/',
    ]],
    ['vendor-syntax', [
        '/node_modules/react-syntax-highlighter/',
    ]],
];

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
                manualChunks(id) {
                    const normalized = id.split(path.sep).join('/');
                    for (const [chunkName, matchers] of chunkMatchers) {
                        if (matchers.some((matcher) => normalized.includes(matcher))) {
                            return chunkName;
                        }
                    }
                    return undefined;
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
