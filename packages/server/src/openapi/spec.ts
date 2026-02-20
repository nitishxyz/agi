import { askPaths } from './paths/ask';
import { authPaths } from './paths/auth';
import { branchPaths } from './paths/branch';
import { configPaths } from './paths/config';
import { doctorPaths } from './paths/doctor';
import { filesPaths } from './paths/files';
import { gitPaths } from './paths/git';
import { mcpPaths } from './paths/mcp';
import { messagesPaths } from './paths/messages';
import { providerUsagePaths } from './paths/provider-usage';
import { researchPaths } from './paths/research';
import { sessionApprovalPaths } from './paths/session-approval';
import { sessionExtrasPaths } from './paths/session-extras';
import { sessionFilesPaths } from './paths/session-files';
import { sessionsPaths } from './paths/sessions';
import { setuPaths } from './paths/setu';
import { skillsPaths } from './paths/skills';
import { streamPaths } from './paths/stream';
import { terminalsPath } from './paths/terminals';
import { tunnelPaths } from './paths/tunnel';
import { schemas } from './schemas';

export function getOpenAPISpec() {
	const spec = {
		openapi: '3.0.3',
		info: {
			title: 'otto server API',
			version: '0.1.0',
			description:
				'Server-side API for otto sessions, messages, and streaming events. All AI work runs on the server. Streaming uses SSE.',
		},
		tags: [
			{ name: 'sessions' },
			{ name: 'messages' },
			{ name: 'stream' },
			{ name: 'ask' },
			{ name: 'config' },
			{ name: 'files' },
			{ name: 'git' },
			{ name: 'terminals' },
			{ name: 'setu' },
			{ name: 'auth' },
			{ name: 'mcp' },
			{ name: 'tunnel' },
		],
		paths: {
			...askPaths,
			...authPaths,
			...branchPaths,
			...configPaths,
			...doctorPaths,
			...filesPaths,
			...gitPaths,
			...mcpPaths,
			...messagesPaths,
			...providerUsagePaths,
			...researchPaths,
			...sessionApprovalPaths,
			...sessionExtrasPaths,
			...sessionFilesPaths,
			...sessionsPaths,
			...setuPaths,
			...skillsPaths,
			...streamPaths,
			...terminalsPath,
			...tunnelPaths,
		},
		components: {
			schemas,
		},
	} as const;
	return spec;
}
