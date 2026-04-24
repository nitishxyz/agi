import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
	site: 'https://ottocode.io',
	output: 'static',
	adapter: cloudflare({
		configPath: process.env.SST_WRANGLER_PATH,
	}),
	integrations: [react(), tailwind(), sitemap()],
	server: { port: 4000 },
});
