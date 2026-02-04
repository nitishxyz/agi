import { c, ICONS, toolColor, truncate } from './theme.ts';

const DANGEROUS_TOOLS = new Set([
	'bash',
	'write',
	'apply_patch',
	'terminal',
	'edit',
	'git_commit',
	'git_push',
]);

export interface ApprovalRequest {
	callId: string;
	toolName: string;
	args: unknown;
	messageId: string;
}

export function renderApprovalPrompt(req: ApprovalRequest): string {
	const color = toolColor(req.toolName);
	const lines: string[] = [];

	lines.push('');
	lines.push(
		`  ${c.yellowBold('⚠')}  ${c.bold('Approval required')} ${c.dim(ICONS.arrow)} ${color(req.toolName)}`,
	);

	const args = (req.args ?? {}) as Record<string, unknown>;
	const preview = extractApprovalPreview(req.toolName, args);
	if (preview) {
		lines.push(`     ${c.dim(preview)}`);
	}

	lines.push('');
	lines.push(
		`  ${c.green('y')}${c.dim('es')}  ${c.red('n')}${c.dim('o')}  ${c.yellow('a')}${c.dim('lways')}`,
	);
	lines.push('');

	return lines.join('\n');
}

function extractApprovalPreview(
	toolName: string,
	args: Record<string, unknown>,
): string {
	switch (toolName) {
		case 'bash':
			if (typeof args.cmd === 'string') return truncate(args.cmd, 80);
			break;
		case 'write':
		case 'edit':
			if (typeof args.path === 'string') return args.path;
			break;
		case 'apply_patch': {
			if (typeof args.patch !== 'string') break;
			const files =
				args.patch.match(/\*\*\* (?:Update|Add|Delete) File: (.+)/g) ?? [];
			const names = files.map((f) =>
				f.replace(/\*\*\* (?:Update|Add|Delete) File: /, ''),
			);
			if (names.length === 1) return names[0];
			if (names.length > 1) return `${names.length} files`;
			break;
		}
		case 'terminal':
			if (typeof args.command === 'string') return truncate(args.command, 80);
			break;
		case 'git_commit':
			if (typeof args.message === 'string')
				return truncate(args.message.split('\n')[0], 60);
			break;
	}
	return '';
}

export async function promptApproval(): Promise<'yes' | 'no' | 'always'> {
	return new Promise((resolve) => {
		const stdin = process.stdin;
		const wasRaw = stdin.isRaw;
		if (stdin.isTTY) stdin.setRawMode(true);
		stdin.resume();

		const cleanup = () => {
			stdin.removeListener('data', onData);
			if (stdin.isTTY && wasRaw !== undefined) stdin.setRawMode(wasRaw);
		};

		const onData = (data: Buffer) => {
			const key = data.toString().toLowerCase();
			if (key === 'y' || key === '\r' || key === '\n') {
				cleanup();
				Bun.write(Bun.stderr, `  ${c.green(ICONS.check)} approved\n`);
				resolve('yes');
			} else if (key === 'n' || key === '\x1b' || key === '\x03') {
				cleanup();
				Bun.write(Bun.stderr, `  ${c.red(ICONS.cross)} denied\n`);
				resolve('no');
			} else if (key === 'a') {
				cleanup();
				Bun.write(
					Bun.stderr,
					`  ${c.yellow(ICONS.check)} auto-approve enabled\n`,
				);
				resolve('always');
			}
		};

		stdin.on('data', onData);
	});
}
