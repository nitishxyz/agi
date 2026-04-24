import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import tailwind from '@astrojs/tailwind';
import react from '@vitejs/plugin-react';

export default defineConfig({
	output: 'server',
	adapter: cloudflare({
		configPath: process.env.SST_WRANGLER_PATH,
		imageService: 'passthrough',
		prerenderEnvironment: 'node',
	}),
	integrations: [tailwind()],
	vite: {
		resolve: {
			alias: [
				{
					find: /^react-syntax-highlighter$/,
					replacement: './src/lib/react-syntax-highlighter.ts',
				},
				{
					find: /packages\/web-sdk\/src\/lib\/api-client$/,
					replacement: './src/lib/api-client-stub.ts',
				},
			],
		},
		plugins: [
			react(),
			{
				name: 'preview-web-server-dep-scan',
				configEnvironment(environmentName) {
					if (!['astro', 'ssr', 'prerender'].includes(environmentName)) {
						return;
					}

					return {
						optimizeDeps: {
							entries: ['src/pages/**/*.astro', 'src/layouts/**/*.astro'],
						},
					};
				},
			},
		],
	},
});
