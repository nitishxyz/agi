import { PATCH_BEGIN_MARKER, PATCH_END_MARKER } from './constants.ts';

export function repairPatchContent(patch: string): string {
	patch = extractPatchFromWrappedJson(patch);
	patch = appendMissingEndMarker(patch);
	return patch;
}

function extractPatchFromWrappedJson(patch: string): string {
	if (patch.includes(PATCH_BEGIN_MARKER)) return patch;

	const trimmed = patch.trim();
	if (!trimmed.startsWith('{')) return patch;

	try {
		const parsed = JSON.parse(trimmed);
		if (typeof parsed === 'object' && parsed !== null) {
			if (typeof parsed.patch === 'string') return parsed.patch;
			if (
				typeof parsed.args === 'object' &&
				parsed.args !== null &&
				typeof parsed.args.patch === 'string'
			) {
				return parsed.args.patch;
			}
		}
	} catch {}

	return patch;
}

function appendMissingEndMarker(patch: string): string {
	const trimmed = patch.trimEnd();
	if (!trimmed.includes(PATCH_BEGIN_MARKER)) return patch;
	if (trimmed.includes(PATCH_END_MARKER)) return patch;

	const hasContent =
		trimmed.includes('*** Update File:') ||
		trimmed.includes('*** Add File:') ||
		trimmed.includes('*** Delete File:') ||
		trimmed.includes('*** Replace in:');

	if (hasContent) {
		return `${trimmed}\n${PATCH_END_MARKER}`;
	}

	return patch;
}
