const SUB = $app.stage === 'prod' ? '' : `${$app.stage}.`;

const HOST = 'agi.nitish.sh';

export const domains = {
	sh: `${SUB}install.${HOST}`,
};
