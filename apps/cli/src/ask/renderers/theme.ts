import chalk from 'chalk';

export const c = {
	dim: chalk.dim,
	bold: chalk.bold,
	italic: chalk.italic,

	blue: chalk.blue,
	cyan: chalk.cyan,
	green: chalk.green,
	yellow: chalk.yellow,
	red: chalk.red,
	magenta: chalk.magenta,
	white: chalk.white,
	gray: chalk.gray,

	blueBold: chalk.blue.bold,
	greenBold: chalk.green.bold,
	yellowBold: chalk.yellow.bold,
	redBold: chalk.red.bold,
	cyanBold: chalk.cyan.bold,
	magentaBold: chalk.magenta.bold,

	dimBlue: chalk.blue.dim,
	dimGreen: chalk.green.dim,
	dimYellow: chalk.yellow.dim,
	dimRed: chalk.red.dim,
	dimCyan: chalk.cyan.dim,

	greenDim: chalk.dim.green,
	redDim: chalk.dim.red,
};

export const TOOL_COLORS: Record<string, (s: string) => string> = {
	read: c.blue,
	ls: c.blue,
	tree: c.cyan,
	ripgrep: c.blue,
	glob: c.cyan,
	git_status: c.blue,
	git_diff: c.blue,

	write: c.green,
	edit: c.green,
	apply_patch: c.green,
	git_commit: c.green,

	bash: c.yellow,
	terminal: c.yellow,

	websearch: c.magenta,

	finish: c.dim,
	skill: c.magenta,
	progress_update: c.cyan,
	update_todos: c.cyan,
};

export function toolColor(name: string): (s: string) => string {
	return TOOL_COLORS[name] ?? c.cyan;
}

export const ICONS = {
	arrow: '›',
	check: '✓',
	cross: '✗',
	dot: '·',
	ellipsis: '…',
	pending: '○',
	spinner: '⋯',
	plus: '+',
	minus: '-',
	pipe: '│',
	todo: '☐',
	todoDone: '☑',
};

export function formatMs(ms?: number): string {
	if (ms === undefined) return '';
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

export function truncate(s: string, max: number): string {
	if (s.length <= max) return s;
	return `${s.slice(0, max - 1)}…`;
}

export function indent(s: string, spaces = 4): string {
	const pad = ' '.repeat(spaces);
	return s
		.split('\n')
		.map((l) => `${pad}${l}`)
		.join('\n');
}

export function pluralize(
	n: number,
	singular: string,
	plural?: string,
): string {
	return n === 1 ? singular : (plural ?? `${singular}s`);
}
