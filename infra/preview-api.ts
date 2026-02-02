import { domains } from './domains';
import { DEPLOYED_STAGES } from './utils';
import { ogFunction } from './og';

export const previewDb = new sst.cloudflare.D1('PreviewDB');

export const ogCache = new sst.cloudflare.Kv('OGCache');

export const shareStorage = new sst.cloudflare.Bucket('ShareStorage');

export const previewApi = new sst.cloudflare.Worker('PreviewApi', {
	handler: 'apps/preview-api/src/index.ts',
	link: [previewDb, ogCache, shareStorage],
	url: true,
	domain: domains.previewApi,
	environment: {
		OG_FUNCTION_URL: ogFunction.url,
	},
	transform: {
		worker: {
			observability: {
				enabled: true,
				logs: {
					enabled: true,
					invocationLogs: true,
				},
			},
		},
	},
});

export const previewApiUrl = DEPLOYED_STAGES.includes($app.stage)
	? `https://${domains.previewApi}`
	: previewApi.url;
