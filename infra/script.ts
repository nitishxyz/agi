import { domains } from './domains';

// Cloudflare Worker to serve the install script
export const script = new sst.cloudflare.Worker('AgiSh', {
	domain: domains.sh,
	handler: 'infra/handlers/install-worket.ts',
	build: {
		loader: {
			'.sh': 'text',
		},
	},
	url: true,
});
