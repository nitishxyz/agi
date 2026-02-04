import AGENT_BUILD from '@ottocode/sdk/prompts/agents/build.txt' with {
	type: 'text',
};
import AGENT_PLAN from '@ottocode/sdk/prompts/agents/plan.txt' with {
	type: 'text',
};
import AGENT_GENERAL from '@ottocode/sdk/prompts/agents/general.txt' with {
	type: 'text',
};

export const BUILTIN_AGENTS = {
	build: {
		prompt: AGENT_BUILD,
		tools: [
			'read',
			'write',
			'ls',
			'tree',
			'bash',
			'update_todos',
			'grep',
			'terminal',
			'git_status',
			'git_diff',
			'ripgrep',
			'apply_patch',
			'websearch',
			'progress_update',
			'finish',
		] as string[],
	},
	plan: {
		prompt: AGENT_PLAN,
		tools: [
			'read',
			'ls',
			'tree',
			'ripgrep',
			'update_todos',
			'websearch',
			'progress_update',
			'finish',
		] as string[],
	},
	general: {
		prompt: AGENT_GENERAL,
		tools: [
			'read',
			'write',
			'ls',
			'tree',
			'bash',
			'ripgrep',
			'terminal',
			'websearch',
			'update_todos',
			'progress_update',
			'finish',
		] as string[],
	},
};

export const BUILTIN_TOOLS = [
	'read',
	'write',
	'ls',
	'tree',
	'bash',
	'terminal',
	'grep',
	'ripgrep',
	'git_status',
	'git_diff',
	'git_commit',
	'apply_patch',
	'update_todos',
	'edit',
	'websearch',
	'progress_update',
	'finish',
	'skill',
] as const;

export type BuiltinAgent = keyof typeof BUILTIN_AGENTS;
export type BuiltinTool = (typeof BUILTIN_TOOLS)[number];
