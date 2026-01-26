import { domains } from './domains';
import { previewApiUrl } from './preview-api';
import { DEPLOYED_STAGES } from './utils';

export const previewWeb = new sst.aws.Astro('PreviewWeb', {
	path: 'apps/preview-web',
	domain: DEPLOYED_STAGES.includes($app.stage)
		? {
				name: domains.previewWeb,
				dns: sst.cloudflare.dns(),
			}
		: undefined,
	environment: {
		PUBLIC_API_URL: previewApiUrl,
	},
	dev: {
		command: 'bun run dev',
		directory: 'apps/preview-web',
	},
});
