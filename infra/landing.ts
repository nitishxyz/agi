import { domains } from './domains';
import { DEPLOYED_STAGES } from './utils';

export const landing = new sst.aws.StaticSite('Landing', {
	path: 'apps/landing',
	build: {
		command: 'bun run build',
		output: 'dist',
	},
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
