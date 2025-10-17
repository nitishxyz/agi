export function stripAnsi(input: string): string {
	let result = '';
	for (let i = 0; i < input.length; i += 1) {
		const ch = input[i];
		if (ch === '\u001B' || ch === '\u009B') {
			// Skip CSI sequences until we hit a terminating byte (A-Z or a-z)
			i += 1;
			while (i < input.length) {
				const code = input[i];
				if (
					code &&
					((code >= '@' && code <= 'Z') || (code >= 'a' && code <= 'z'))
				) {
					break;
				}
				i += 1;
			}
		} else {
			result += ch;
		}
	}
	return result;
}

export function normalizeTerminalLine(line: string): string {
	return stripAnsi(line).replace(/\r/g, '');
}
