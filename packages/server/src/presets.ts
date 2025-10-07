import AGENT_BUILD from '@agi-cli/sdk/prompts/agents/build.txt' with {
	type: 'text',
};
import AGENT_PLAN from '@agi-cli/sdk/prompts/agents/plan.txt' with {
	type: 'text',
};
import AGENT_GENERAL from '@agi-cli/sdk/prompts/agents/general.txt' with {
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
			'update_plan',
			'grep',
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
			'update_plan',
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
			'websearch',
			'update_plan',
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
	'grep',
	'ripgrep',
	'git_status',
	'git_diff',
	'git_commit',
	'apply_patch',
	'update_plan',
	'edit',
	'websearch',
	'progress_update',
	'finish',
] as const;

export type BuiltinAgent = keyof typeof BUILTIN_AGENTS;
export type BuiltinTool = (typeof BUILTIN_TOOLS)[number];
