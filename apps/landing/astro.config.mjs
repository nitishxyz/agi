import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import aws from 'astro-sst';

export default defineConfig({
	site: 'https://ottocode.io',
	output: 'static',
	adapter: aws(),
	integrations: [react(), tailwind(), sitemap()],
	server: { port: 4000 },
});
