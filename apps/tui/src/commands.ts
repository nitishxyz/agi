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
	q: 'quit',
	'?': 'help',
	x: 'stop',
	t: 'theme',
	m: 'models',
};

export function resolveCommand(name: string): string {
	return COMMAND_ALIASES[name] || name;
}

export const COMMANDS = [
	{ name: 'models', alias: '/m', description: 'Open model selector' },
	{ name: 'new', alias: '', description: 'Create a new session' },
	{ name: 'stop', alias: '/x', description: 'Stop current generation' },
	{ name: 'help', alias: '/?', description: 'Show this help' },
	{ name: 'reasoning', alias: '', description: 'Toggle extended thinking' },
	{ name: 'stage', alias: '', description: 'Stage all changes (git add -A)' },
	{ name: 'commit', alias: '', description: 'Open commit overlay' },
	{ name: 'compact', alias: '', description: 'Compact conversation history' },
	{ name: 'delete', alias: '', description: 'Delete current session' },
	{ name: 'share', alias: '', description: 'Share session publicly' },
	{
		name: 'sync',
		alias: '',
		description: 'Sync new messages to shared session',
	},
	{ name: 'sessions', alias: '/s', description: 'List and switch sessions' },
	{ name: 'provider', alias: '', description: 'Quick-switch provider' },
	{ name: 'theme', alias: '/t', description: 'Switch color theme' },
	{ name: 'clear', alias: '', description: 'Reload messages' },
	{ name: 'quit', alias: '/q', description: 'Exit TUI' },
];
