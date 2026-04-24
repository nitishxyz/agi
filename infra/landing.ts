import { domains } from './domains';
import { DEPLOYED_STAGES } from './utils';
import { previewApiUrl } from './preview-api';

export const landing = new sst.cloudflare.Astro('Landing', {
	path: 'apps/landing',
	buildCommand: 'bun run build',
	domain: DEPLOYED_STAGES.includes($app.stage) ? domains.landing : undefined,
	environment: {
		PUBLIC_OG_URL: $interpolate`${previewApiUrl}/og/page`,
	},
	dev: {
		command: 'bun run dev',
		directory: 'apps/landing',
	},
});
