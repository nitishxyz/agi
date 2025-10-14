export function splitLines(value: string): {
	lines: string[];
	newline: string;
} {
	const newline = value.includes('\r\n') ? '\r\n' : '\n';
	const normalized = newline === '\n' ? value : value.replace(/\r\n/g, '\n');
	const parts = normalized.split('\n');
	if (parts.length > 0 && parts[parts.length - 1] === '') {
		parts.pop();
	}
	return { lines: parts, newline };
}

export function joinLines(lines: string[], newline: string): string {
	const base = lines.join('\n');
	return newline === '\n' ? base : base.replace(/\n/g, newline);
}

export function ensureTrailingNewline(lines: string[]) {
	if (lines.length === 0 || lines[lines.length - 1] !== '') {
		lines.push('');
	}
}
