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
