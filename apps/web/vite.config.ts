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
				manualChunks: undefined,
			},
		},
		chunkSizeWarningLimit: 1000,
	},
});
