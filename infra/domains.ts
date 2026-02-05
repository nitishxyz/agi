const SUB = $app.stage === 'prod' ? '' : `${$app.stage}.`;

const HOST = 'ottocode.io';

export const domains = {
	landing: `${SUB}${HOST}`,
	landingWww: `www.${SUB}${HOST}`,
	sh: `${SUB}install.${HOST}`,
	previewApi: `${SUB}api.share.${HOST}`,
	previewWeb: `${SUB}share.${HOST}`,
	setu: `${SUB}setu.${HOST}`,
};
