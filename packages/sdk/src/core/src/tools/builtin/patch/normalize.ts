enum NormalizationLevel {
	EXACT = 'exact',
	TABS_ONLY = 'tabs',
	WHITESPACE = 'whitespace',
	AGGRESSIVE = 'aggressive',
}

export function normalizeWhitespace(
	line: string,
	level: NormalizationLevel,
): string {
	switch (level) {
		case NormalizationLevel.EXACT:
			return line;
		case NormalizationLevel.TABS_ONLY:
			return line.replace(/\t/g, '  ');
		case NormalizationLevel.WHITESPACE:
			return line.replace(/\t/g, '  ').replace(/\s+$/, '');
		case NormalizationLevel.AGGRESSIVE:
			return line.replace(/\t/g, '  ').trim();
		default:
			return line;
	}
}

export const NORMALIZATION_LEVELS: NormalizationLevel[] = [
	NormalizationLevel.EXACT,
	NormalizationLevel.TABS_ONLY,
	NormalizationLevel.WHITESPACE,
	NormalizationLevel.AGGRESSIVE,
];

export function getLeadingWhitespace(line: string): string {
	const match = line.match(/^(\s*)/);
	return match ? match[1] : '';
}

export function computeIndentDelta(
	modelLine: string,
	fileLine: string,
): number {
	return (
		getLeadingWhitespace(fileLine).length -
		getLeadingWhitespace(modelLine).length
	);
}

export function applyIndentDelta(line: string, delta: number): string {
	if (delta === 0 || line.trim() === '') return line;
	const ws = getLeadingWhitespace(line);
	const newLen = Math.max(0, ws.length + delta);
	return ' '.repeat(newLen) + line.slice(ws.length);
}
