// Minimal UI utilities for non-interactive output (no external deps)

const ESC = '\u001b[';
function code(n: number) {
	return `${ESC}${n}m`;
}

export const colors = {
	bold: (s: string) => code(1) + s + code(22),
	dim: (s: string) => code(2) + s + code(22),
	red: (s: string) => code(31) + s + code(39),
	green: (s: string) => code(32) + s + code(39),
	yellow: (s: string) => code(33) + s + code(39),
	blue: (s: string) => code(34) + s + code(39),
	cyan: (s: string) => code(36) + s + code(39),
};

export function box(title: string, bodyLines: string[] | string) {
	const lines = Array.isArray(bodyLines) ? bodyLines : bodyLines.split('\n');
	const contentLines = title ? [colors.bold(title), ...lines] : lines;
	const width = Math.min(
		Math.max(...contentLines.map((l) => stripAnsi(l).length)) + 2,
		(process.stdout.columns || 80) - 2,
	);
	const top = '┌' + '─'.repeat(width) + '┐';
	const bot = '└' + '─'.repeat(width) + '┘';
	console.log(top);
	for (let i = 0; i < contentLines.length; i++) {
		const raw = contentLines[i];
		const pad = width - stripAnsi(raw).length;
		console.log('│ ' + raw + ' '.repeat(pad - 1) + '│');
	}
	console.log(bot);
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
	return s + ' '.repeat(Math.max(0, w - len));
}

function stripAnsi(s: string) {
	// eslint-disable-next-line no-control-regex
	return s.replace(
		/[\u001B\u009B][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nq-uy=><]/g,
		'',
	);
}
