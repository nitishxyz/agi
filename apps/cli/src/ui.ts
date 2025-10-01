// UI utilities with enhanced markdown rendering

import { marked, type Renderer } from 'marked';
import TerminalRenderer from 'marked-terminal';

type TerminalRendererOptions = {
	showSectionPrefix?: boolean;
	width?: number;
	reflowText?: boolean;
	tab?: number;
	emoji?: boolean;
	unescape?: boolean;
};

type TerminalRendererConstructor = new (
	options?: TerminalRendererOptions,
) => Renderer;

// Configure marked with terminal renderer
const terminalRenderer = new (
	TerminalRenderer as unknown as TerminalRendererConstructor
)({
	showSectionPrefix: false,
	width: process.stdout.columns || 80,
	reflowText: true,
	tab: 2,
	emoji: true,
	unescape: true,
} satisfies TerminalRendererOptions);

// Set the renderer directly
marked.setOptions({
	renderer: terminalRenderer,
});

const ESC = '\u001b[';
function code(n: number) {
	return `${ESC}${n}m`;
}

export const colors = {
	bold: (s: string) => `${code(1)}${s}${code(22)}`,
	dim: (s: string) => `${code(2)}${s}${code(22)}`,
	red: (s: string) => `${code(31)}${s}${code(39)}`,
	green: (s: string) => `${code(32)}${s}${code(39)}`,
	yellow: (s: string) => `${code(33)}${s}${code(39)}`,
	blue: (s: string) => `${code(34)}${s}${code(39)}`,
	cyan: (s: string) => `${code(36)}${s}${code(39)}`,
};

export function renderMarkdown(markdown: string) {
	try {
		// Use marked-terminal for rich markdown rendering
		const result = marked(markdown);
		// Handle both sync and async versions of marked
		if (typeof result === 'string') {
			return result.trimEnd();
		}
		// For async version (shouldn't happen with terminal renderer, but safe fallback)
		return renderMarkdownFallback(markdown);
	} catch (_err) {
		// Fallback to basic rendering if marked fails
		return renderMarkdownFallback(markdown);
	}
}

// Keep the original basic renderer as fallback
function renderMarkdownFallback(markdown: string) {
	const normalized = markdown.replace(/\r\n/g, '\n');
	const lines = normalized.split('\n');
	const rendered: string[] = [];
	let previousBlank = true;
	let inCodeBlock = false;
	let orderedIndex = 1;
	for (const raw of lines) {
		const line = raw.replace(/\t/g, '    ');
		const trimmed = line.trim();
		if (trimmed.startsWith('```')) {
			if (!previousBlank) rendered.push('');
			rendered.push(colors.dim(trimmed));
			inCodeBlock = !inCodeBlock;
			previousBlank = false;
			continue;
		}
		if (inCodeBlock) {
			rendered.push(`  ${line}`);
			previousBlank = false;
			continue;
		}
		if (!trimmed.length) {
			if (!previousBlank) rendered.push('');
			previousBlank = true;
			orderedIndex = 1;
			continue;
		}
		previousBlank = false;
		let outputLine = trimmed;
		const heading = /^#{1,6}\s+/.exec(trimmed);
		if (heading) {
			const text = trimmed.replace(/^#{1,6}\s+/, '').trim();
			outputLine = colors.bold(text.toUpperCase());
			orderedIndex = 1;
		} else if (/^>\s+/.test(trimmed)) {
			outputLine = `${colors.dim('│')} ${trimmed.replace(/^>\s+/, '')}`;
			orderedIndex = 1;
		} else if (/^[-*+]\s+/.test(trimmed)) {
			outputLine = `• ${trimmed.replace(/^[-*+]\s+/, '')}`;
			orderedIndex = 1;
		} else if (/^\d+\.\s+/.test(trimmed)) {
			outputLine = `${orderedIndex}. ${trimmed.replace(/^\d+\.\s+/, '')}`;
			orderedIndex += 1;
		} else {
			orderedIndex = 1;
		}
		rendered.push(outputLine);
	}
	while (rendered.length && rendered[rendered.length - 1] === '')
		rendered.pop();
	return rendered.join('\n');
}

export function box(title: string, bodyLines: string[] | string) {
	const lines = Array.isArray(bodyLines) ? bodyLines : bodyLines.split('\n');
	const contentLines = title ? [colors.bold(title), ...lines] : lines;
	const printableLengths = contentLines.length
		? contentLines.map((l) => stripAnsi(l).length)
		: [0];
	const maxLen = Math.max(...printableLengths);
	const desiredWidth = maxLen + 2;
	const terminalWidth = getTerminalWidth();
	const width = Math.max(
		2,
		Math.min(desiredWidth, terminalWidth ?? desiredWidth),
	);
	const top = `┌${'─'.repeat(width)}┐`;
	const bot = `└${'─'.repeat(width)}┘`;
	console.log(top);
	for (const raw of contentLines) {
		const visibleLen = stripAnsi(raw).length;
		const pad = Math.max(0, width - visibleLen);
		const spacing = ' '.repeat(Math.max(0, pad - 1));
		console.log(`│ ${raw}${spacing}│`);
	}
	console.log(bot);
}

function getTerminalWidth() {
	const cols = process.stdout?.columns;
	if (typeof cols !== 'number' || !Number.isFinite(cols)) return undefined;
	const adjusted = Math.floor(cols) - 2;
	return adjusted > 0 ? adjusted : undefined;
}

export function table(headers: string[], rows: string[][]) {
	const all = [headers, ...rows];
	const cols = headers.length;
	const widths = new Array(cols).fill(0);
	for (const r of all) {
		for (let i = 0; i < cols; i++)
			widths[i] = Math.max(widths[i], stripAnsi(r[i] ?? '').length);
	}
	const sep = '  ';
	console.log(headers.map((h, i) => colors.bold(pad(h, widths[i]))).join(sep));
	console.log(widths.map((w) => '─'.repeat(w)).join(sep));
	for (const r of rows)
		console.log(r.map((c, i) => pad(c ?? '', widths[i])).join(sep));
}

function pad(s: string, w: number) {
	const len = stripAnsi(s).length;
	return `${s}${' '.repeat(Math.max(0, w - len))}`;
}

function stripAnsi(s: string) {
	let result = '';
	for (let i = 0; i < s.length; i += 1) {
		const ch = s[i];
		if (ch === '\u001B' || ch === '\u009B') {
			// Skip over CSI sequences until we hit a letter terminator
			i += 1;
			while (i < s.length) {
				const code = s[i];
				if (
					code &&
					((code >= '@' && code <= 'Z') || (code >= 'a' && code <= 'z'))
				)
					break;
				i += 1;
			}
		} else {
			result += ch;
		}
	}
	return result;
}
