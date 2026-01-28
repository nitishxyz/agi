import { databaseUrl } from './secrets';

export const orm = new sst.x.DevCommand('Studio', {
	link: [databaseUrl],
	dev: {
		command: 'npx drizzle-kit studio',
		directory: 'apps/setu',
	},
});
