/**
 * File content cache to track modifications during a session/step
 * This helps ensure tools always work with the latest file content
 */

const fileContentCache = new Map<string, Map<string, string>>();

export function getFileCache(sessionId: string): Map<string, string> {
	if (!fileContentCache.has(sessionId)) {
		fileContentCache.set(sessionId, new Map());
	}
	return fileContentCache.get(sessionId) as Map<string, string>;
}

export function updateFileCache(
	sessionId: string,
	filePath: string,
	content: string,
): void {
	const cache = getFileCache(sessionId);
	cache.set(filePath, content);
}

export function getCachedContent(
	sessionId: string,
	filePath: string,
): string | undefined {
	const cache = getFileCache(sessionId);
	return cache.get(filePath);
}

export function clearFileCache(sessionId: string): void {
	fileContentCache.delete(sessionId);
}

export function clearFileCacheEntry(sessionId: string, filePath: string): void {
	const cache = getFileCache(sessionId);
	cache.delete(filePath);
}
