import { handler } from './index';

const server = Bun.serve({
	port: 3900,
	async fetch(req) {
		const url = new URL(req.url);
		const params: Record<string, string> = {};
		url.searchParams.forEach((v, k) => {
			params[k] = v;
		});

		const result = await handler({ queryStringParameters: params });
		const body = Buffer.from(result.body, 'base64');

		return new Response(body, {
			status: result.statusCode,
			headers: result.headers as Record<string, string>,
		});
	},
});

console.log(`OG image server running at http://localhost:${server.port}`);
