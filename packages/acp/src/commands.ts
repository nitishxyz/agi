export function splitCommandArgs(input: string): string[] {
	const args: string[] = [];
	const regex = /"([^"]*)"|'([^']*)'|\S+/g;
	let match: RegExpExecArray | null = regex.exec(input);
	while (match !== null) {
		args.push(match[1] ?? match[2] ?? match[0]);
		match = regex.exec(input);
	}
	return args;
}
