import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import aws from 'astro-sst';

export default defineConfig({
	output: 'static',
	adapter: aws(),
	integrations: [react(), tailwind()],
	server: { port: 4000 },
});
