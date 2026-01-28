export const ogFunction = new sst.aws.Function('OGFunction', {
	handler: 'functions/og/index.handler',
	runtime: 'nodejs20.x',
	memory: '1024 MB',
	timeout: '30 seconds',
	url: true,
	nodejs: {
		install: ['@resvg/resvg-js', '@resvg/resvg-js-linux-x64-gnu'],
	},
});

export const ogFunctionUrl = ogFunction.url;
