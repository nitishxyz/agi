import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
	plugins: [TanStackRouterVite(), react()],
	server: {
		watch: {
			// Watch the web-sdk source directory
			ignored: ['!**/packages/web-sdk/**'],
		},
	},
	optimizeDeps: {
		// EXCLUDE web-sdk from pre-bundling so changes are picked up immediately
		exclude: ['@agi-cli/web-sdk'],
	},
	resolve: {
		alias: {
			// Resolve workspace packages to their source instead of dist
			'@agi-cli/web-sdk': path.resolve(__dirname, '../../packages/web-sdk/src'),
		},
		// Deduplicate React and React-DOM to prevent multiple instances
		dedupe: ['react', 'react-dom', 'react/jsx-runtime'],
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (
						id.includes('react-syntax-highlighter') ||
						id.includes('refractor') ||
						id.includes('prismjs')
					) {
						return 'syntax';
					}
					if (
						id.includes('react-markdown') ||
						id.includes('remark') ||
						id.includes('rehype') ||
						id.includes('unified') ||
						id.includes('mdast') ||
						id.includes('hast') ||
						id.includes('micromark')
					) {
						return 'markdown';
					}
					if (
						id.includes('node_modules/react/') ||
						id.includes('node_modules/react-dom/') ||
						id.includes('scheduler')
					) {
						return 'react';
					}
					if (id.includes('@tanstack')) {
						return 'router';
					}
					if (id.includes('lucide-react')) {
						return 'icons';
					}
				},
			},
		},
		chunkSizeWarningLimit: 500,
	},
});
