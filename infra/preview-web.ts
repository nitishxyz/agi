import { domains } from './domains';
import { previewApiUrl } from './preview-api';
import { DEPLOYED_STAGES } from './utils';

export const previewWeb = new sst.cloudflare.Astro('PreviewWeb', {
	path: 'apps/preview-web',
	domain: DEPLOYED_STAGES.includes($app.stage) ? domains.previewWeb : undefined,
	environment: {
		PUBLIC_API_URL: previewApiUrl,
	},
	dev: {
		command: 'bun run dev',
		directory: 'apps/preview-web',
	},
});
