export function normalizeLineEndings(text: string): string {
	return text.replace(/\r\n/g, '\n');
}

export function detectLineEnding(text: string): '\n' | '\r\n' {
	return text.includes('\r\n') ? '\r\n' : '\n';
}

export function convertToLineEnding(
	text: string,
	lineEnding: '\n' | '\r\n',
): string {
	if (lineEnding === '\n') return text;
	return text.replace(/\n/g, '\r\n');
}

function countOccurrences(content: string, search: string): number {
	if (!search) return 0;
	let count = 0;
	let start = 0;
	while (true) {
		const index = content.indexOf(search, start);
		if (index === -1) return count;
		count += 1;
		start = index + search.length;
	}
}

export function applyStringEdit(
	content: string,
	oldString: string,
	newString: string,
	replaceAll = false,
): { content: string; occurrences: number } {
	if (oldString.length === 0) {
		throw new Error(
			'oldString must not be empty. Use write to create files or apply_patch for structural insertions.',
		);
	}
	if (oldString === newString) {
		throw new Error(
			'No changes to apply: oldString and newString are identical.',
		);
	}

	const lineEnding = detectLineEnding(content);
	const normalizedOld = convertToLineEnding(
		normalizeLineEndings(oldString),
		lineEnding,
	);
	const normalizedNew = convertToLineEnding(
		normalizeLineEndings(newString),
		lineEnding,
	);

	const occurrences = countOccurrences(content, normalizedOld);
	if (occurrences === 0) {
		throw new Error(
			'oldString not found in content. Read the file again and copy the exact text, including whitespace.',
		);
	}
	if (occurrences > 1 && !replaceAll) {
		throw new Error(
			'Found multiple matches for oldString. Provide more surrounding lines to make it unique or set replaceAll to true.',
		);
	}

	if (replaceAll) {
		return {
			content: content.split(normalizedOld).join(normalizedNew),
			occurrences,
		};
	}

	const index = content.indexOf(normalizedOld);
	return {
		content:
			content.slice(0, index) +
			normalizedNew +
			content.slice(index + normalizedOld.length),
		occurrences,
	};
}
