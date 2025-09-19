/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
	app(input) {
		return {
			name: 'agi',
			removal: input?.stage === 'prod' ? 'retain' : 'remove',
			// protect: ["prod"].includes(input?.stage),
			home: 'aws',
			providers: {
				aws: {
					profile: 'slashforge',
					region: 'us-east-1',
				},
			},
		};
	},
	async run() {
		const { script } = await import('./infra/script');

		return {
			script: script.url,
		};
	},
});
