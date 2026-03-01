export interface ParsedCommand {
	name: string;
	args: string;
}

export function parseCommand(input: string): ParsedCommand | null {
	const trimmed = input.trim();
	if (!trimmed.startsWith('/')) return null;

	const spaceIdx = trimmed.indexOf(' ');
	if (spaceIdx === -1) {
		return { name: trimmed.slice(1).toLowerCase(), args: '' };
	}
	return {
		name: trimmed.slice(1, spaceIdx).toLowerCase(),
		args: trimmed.slice(spaceIdx + 1).trim(),
	};
}

export const COMMAND_ALIASES: Record<string, string> = {
	s: 'sessions',
	c: 'config',
	q: 'quit',
	'?': 'help',
	x: 'stop',
};

export function resolveCommand(name: string): string {
	return COMMAND_ALIASES[name] || name;
}

export const COMMANDS = [
	{ name: 'sessions', alias: '/s', description: 'List and switch sessions' },
	{ name: 'new', alias: '', description: 'Create a new session' },
	{ name: 'config', alias: '/c', description: 'Change provider/model/agent' },
	{ name: 'model', alias: '', description: 'Quick-switch model' },
	{ name: 'provider', alias: '', description: 'Quick-switch provider' },
	{ name: 'agent', alias: '', description: 'Quick-switch agent' },
	{ name: 'compact', alias: '', description: 'Compact conversation history' },
	{ name: 'stop', alias: '/x', description: 'Stop current generation' },
	{ name: 'delete', alias: '', description: 'Delete current session' },
	{ name: 'clear', alias: '', description: 'Reload messages' },
	{ name: 'help', alias: '/?', description: 'Show this help' },
	{ name: 'quit', alias: '/q', description: 'Exit TUI' },
];
