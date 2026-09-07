import { getTheme } from '@ottocode/themes';
import type { ITheme } from 'ghostty-web';

export type TerminalTheme = Required<ITheme>;

export const TERMINAL_ANSI_COLORS = [
	'black',
	'red',
	'green',
	'yellow',
	'blue',
	'magenta',
	'cyan',
	'white',
	'brightBlack',
	'brightRed',
	'brightGreen',
	'brightYellow',
	'brightBlue',
	'brightMagenta',
	'brightCyan',
	'brightWhite',
] as const;

function renderedColor(
	className: string,
	property: 'color' | 'backgroundColor',
	fallback: string,
): string {
	if (typeof document === 'undefined') return fallback;
	const element = document.createElement('span');
	element.className = className;
	element.style.visibility = 'hidden';
	element.style.position = 'fixed';
	document.body.appendChild(element);
	const value = getComputedStyle(element)[property];
	element.remove();
	const match = value.match(
		/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/,
	);
	if (!match || (match[4] !== undefined && Number(match[4]) !== 1))
		return fallback;
	return `#${match
		.slice(1, 4)
		.map((channel) => Number(channel).toString(16).padStart(2, '0'))
		.join('')}`;
}

/** Uses rendered CSS overrides for UI colors and the active palette for ANSI. */
export function resolveTerminalTheme(themeId?: string): TerminalTheme {
	const activeId =
		themeId ??
		(typeof document === 'undefined'
			? undefined
			: document.documentElement.dataset.theme);
	const { colors: c } = getTheme(activeId);
	const foreground = renderedColor('text-foreground', 'color', c.fg);
	const background = renderedColor('bg-background', 'backgroundColor', c.bg);
	return {
		background,
		foreground,
		cursor: foreground,
		cursorAccent: background,
		selectionBackground: renderedColor(
			'bg-accent',
			'backgroundColor',
			c.bgHighlight,
		),
		selectionForeground: renderedColor(
			'text-accent-foreground',
			'color',
			c.fgBright,
		),
		black: c.bgDark,
		red: c.red,
		green: c.green,
		yellow: c.yellow,
		blue: c.blue,
		magenta: c.purple,
		cyan: c.cyan,
		white: c.fg,
		brightBlack: c.fgDark,
		brightRed: c.red,
		brightGreen: c.green,
		brightYellow: c.orange,
		brightBlue: c.blue,
		brightMagenta: c.magenta,
		brightCyan: c.teal,
		brightWhite: c.fgBright,
	};
}

/** Observes applied themes, including shell-driven changes before config loads. */
export function observeTerminalTheme(
	onTheme: (theme: TerminalTheme) => void,
): () => void {
	const observer = new MutationObserver(() => onTheme(resolveTerminalTheme()));
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['data-theme', 'class', 'style'],
	});
	return () => observer.disconnect();
}
