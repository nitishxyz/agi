import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
	plugins: [TanStackRouterVite(), react()],
	server: {
		watch: {
			// Watch for changes in workspace packages
			ignored: ['!**/node_modules/@agi-cli/**'],
		},
	},
	optimizeDeps: {
		// Force Vite to include workspace packages in dependency optimization
		include: ['@agi-cli/web-sdk'],
	},
	resolve: {
		alias: {
			// Resolve workspace packages to their source instead of dist
			'@agi-cli/web-sdk': path.resolve(__dirname, '../../packages/web-sdk/src'),
		},
	},
});
