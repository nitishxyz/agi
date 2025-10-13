import { askPaths } from './paths/ask';
import { configPaths } from './paths/config';
import { filesPaths } from './paths/files';
import { gitPaths } from './paths/git';
import { messagesPaths } from './paths/messages';
import { sessionsPaths } from './paths/sessions';
import { streamPaths } from './paths/stream';
import { schemas } from './schemas';

export function getOpenAPISpec() {
	const spec = {
		openapi: '3.0.3',
		info: {
			title: 'AGI Server API',
			version: '0.1.0',
			description:
				'Server-side API for AGI sessions, messages, and streaming events. All AI work runs on the server. Streaming uses SSE.',
		},
	tags: [
		{ name: 'sessions' },
		{ name: 'messages' },
		{ name: 'stream' },
		{ name: 'ask' },
		{ name: 'config' },
		{ name: 'files' },
		{ name: 'git' },
	],
	paths: {
		...askPaths,
		...sessionsPaths,
		...messagesPaths,
		...streamPaths,
		...configPaths,
		...filesPaths,
		...gitPaths,
	},
		components: {
			schemas,
		},
	} as const;
	return spec;
}
