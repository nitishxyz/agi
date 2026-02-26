import { domains } from './domains';
import { DEPLOYED_STAGES } from './utils';

export const landing = new sst.aws.Astro('Landing', {
	path: 'apps/landing',
	buildCommand: 'bun run build',
	domain: DEPLOYED_STAGES.includes($app.stage)
		? {
				name: domains.landing,
				redirects: [domains.landingWww],
				dns: sst.cloudflare.dns(),
			}
		: undefined,
	dev: {
		command: 'bun run dev',
		directory: 'apps/landing',
	},
});
