import {
	Terminal,
	Sparkles,
	Plus,
	Keyboard,
	Code,
	Brain,
	StopCircle,
} from 'lucide-react';

export interface Command {
	id: string;
	label: string;
	description: string | ((state: CommandState) => string);
	icon: typeof Terminal;
}

export interface CommandState {
	vimModeEnabled: boolean;
	reasoningEnabled: boolean;
}

export const COMMANDS: Command[] = [
	{
		id: 'models',
		label: '/models',
		description: 'Open model selector',
		icon: Sparkles,
	},
	{
		id: 'agents',
		label: '/agents',
		description: 'Open agent selector',
		icon: Terminal,
	},
	{
		id: 'new',
		label: '/new',
		description: 'Create new session',
		icon: Plus,
	},
	{
		id: 'stop',
		label: '/stop',
		description: 'Stop current generation',
		icon: StopCircle,
	},
	{
		id: 'help',
		label: '/help',
		description: 'Show keyboard shortcuts and help',
		icon: Keyboard,
	},
	{
		id: 'vim',
		label: '/vim',
		description: (state) =>
			state.vimModeEnabled ? 'Disable Vim mode' : 'Enable Vim mode',
		icon: Code,
	},
	{
		id: 'reasoning',
		label: '/reasoning',
		description: (state) =>
			state.reasoningEnabled
				? 'Disable extended thinking'
				: 'Enable extended thinking',
		icon: Brain,
	},
];

export function getCommandDescription(
	cmd: Command,
	state: CommandState,
): string {
	return typeof cmd.description === 'function'
		? cmd.description(state)
		: cmd.description;
}

export function filterCommands(query: string, state: CommandState): Command[] {
	if (!query) {
		return COMMANDS;
	}

	const lowerQuery = query.toLowerCase();
	const matches: (Command & { matchScore: number })[] = [];

	for (const cmd of COMMANDS) {
		const desc = getCommandDescription(cmd, state);
		const labelMatch = cmd.label.toLowerCase().includes(lowerQuery);
		const descriptionMatch = desc.toLowerCase().includes(lowerQuery);

		if (labelMatch || descriptionMatch) {
			const matchScore = labelMatch ? 10 : 5;
			matches.push({ ...cmd, matchScore });
		}
	}

	return matches.sort((a, b) => {
		const scoreDiff = b.matchScore - a.matchScore;
		if (scoreDiff !== 0) return scoreDiff;
		return a.label.localeCompare(b.label);
	});
}
