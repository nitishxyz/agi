import { domains } from './domains';
import { DEPLOYED_STAGES } from './utils';

export const previewDb = new sst.cloudflare.D1('PreviewDB');

export const ogCache = new sst.cloudflare.Kv('OGCache');

export const previewApi = new sst.cloudflare.Worker('PreviewApi', {
	handler: 'apps/preview-api/src/index.ts',
	link: [previewDb, ogCache],
	url: true,
	domain: domains.previewApi,
});

export const previewApiUrl = DEPLOYED_STAGES.includes($app.stage)
	? `https://${domains.previewApi}`
	: previewApi.url;
