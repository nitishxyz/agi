import type { SkillMetadata } from './types.ts';

const NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_COMPATIBILITY_LENGTH = 500;

export class SkillValidationError extends Error {
	constructor(
		message: string,
		public path: string,
	) {
		super(message);
		this.name = 'SkillValidationError';
	}
}

export function validateMetadata(
	meta: unknown,
	path: string,
): asserts meta is SkillMetadata {
	if (!meta || typeof meta !== 'object') {
		throw new SkillValidationError(`Invalid frontmatter in ${path}`, path);
	}

	const m = meta as Record<string, unknown>;

	if (typeof m.name !== 'string' || !m.name) {
		throw new SkillValidationError(
			`Missing required 'name' field in ${path}`,
			path,
		);
	}
	if (m.name.length > MAX_NAME_LENGTH) {
		throw new SkillValidationError(
			`Skill name exceeds ${MAX_NAME_LENGTH} chars in ${path}`,
			path,
		);
	}
	if (!NAME_REGEX.test(m.name)) {
		throw new SkillValidationError(
			`Invalid skill name '${m.name}' - must be lowercase alphanumeric with hyphens, no start/end hyphens, no consecutive hyphens`,
			path,
		);
	}

	if (typeof m.description !== 'string' || !m.description) {
		throw new SkillValidationError(
			`Missing required 'description' field in ${path}`,
			path,
		);
	}
	if (m.description.length > MAX_DESCRIPTION_LENGTH) {
		throw new SkillValidationError(
			`Description exceeds ${MAX_DESCRIPTION_LENGTH} chars in ${path}`,
			path,
		);
	}

	if (
		m.compatibility &&
		typeof m.compatibility === 'string' &&
		m.compatibility.length > MAX_COMPATIBILITY_LENGTH
	) {
		throw new SkillValidationError(
			`Compatibility exceeds ${MAX_COMPATIBILITY_LENGTH} chars in ${path}`,
			path,
		);
	}

	if (m.metadata !== undefined) {
		if (typeof m.metadata !== 'object' || m.metadata === null) {
			throw new SkillValidationError(
				`metadata must be an object in ${path}`,
				path,
			);
		}
		for (const [key, value] of Object.entries(
			m.metadata as Record<string, unknown>,
		)) {
			if (typeof value !== 'string') {
				throw new SkillValidationError(
					`metadata.${key} must be a string in ${path}`,
					path,
				);
			}
		}
	}

	if (m['allowed-tools'] !== undefined && m.allowedTools === undefined) {
		m.allowedTools = m['allowed-tools'];
	}

	if (m.allowedTools !== undefined) {
		if (typeof m.allowedTools === 'string') {
			m.allowedTools = m.allowedTools.split(/\s+/).filter(Boolean);
		}
		if (!Array.isArray(m.allowedTools)) {
			throw new SkillValidationError(
				`allowed-tools must be a string or array in ${path}`,
				path,
			);
		}
	}
}

export function validateSkillName(name: string): boolean {
	if (!name || name.length > MAX_NAME_LENGTH) return false;
	return NAME_REGEX.test(name);
}
