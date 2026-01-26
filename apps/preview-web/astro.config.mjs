import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import aws from 'astro-sst';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
	output: 'server',
	adapter: aws(),
	integrations: [react(), tailwind()],
});
