import type { SkillDefinition, SkillMetadata, SkillScope } from './types.ts';
import { validateMetadata } from './validator.ts';

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

export function parseSkillFile(
	content: string,
	path: string,
	scope: SkillScope,
): SkillDefinition {
	const match = content.match(FRONTMATTER_REGEX);
	if (!match) {
		throw new Error(`Invalid SKILL.md format: missing frontmatter in ${path}`);
	}

	const [, yamlStr, body] = match;
	if (!yamlStr) {
		throw new Error(`Empty frontmatter in ${path}`);
	}

	const metadata = parseYamlFrontmatter(yamlStr, path);
	validateMetadata(metadata, path);

	return {
		metadata: metadata as SkillMetadata,
		content: body?.trim() ?? '',
		path,
		scope,
	};
}

function parseYamlFrontmatter(
	yaml: string,
	_path: string,
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	const lines = yaml.split('\n');
	let currentKey: string | null = null;
	let currentIndent = 0;
	let nestedObject: Record<string, string> | null = null;

	for (const line of lines) {
		if (!line.trim()) continue;

		const indent = line.search(/\S/);
		const trimmed = line.trim();

		if (indent === 0 || (indent <= currentIndent && nestedObject)) {
			if (nestedObject && currentKey) {
				result[currentKey] = nestedObject;
				nestedObject = null;
				currentKey = null;
			}
		}

		const colonIdx = trimmed.indexOf(':');
		if (colonIdx === -1) continue;

		const key = trimmed.slice(0, colonIdx).trim();
		const value = trimmed.slice(colonIdx + 1).trim();

		if (indent > 0 && nestedObject) {
			nestedObject[key] = parseYamlValue(value);
			continue;
		}

		if (!value) {
			currentKey = normalizeKey(key);
			currentIndent = indent;
			nestedObject = {};
			continue;
		}

		result[normalizeKey(key)] = parseYamlValue(value);
	}

	if (nestedObject && currentKey) {
		result[currentKey] = nestedObject;
	}

	return result;
}

function normalizeKey(key: string): string {
	if (key === 'allowed-tools') return 'allowedTools';
	return key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function parseYamlValue(value: string): string {
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		return value.slice(1, -1);
	}
	return value;
}

export function extractFrontmatter(
	content: string,
): { frontmatter: string; body: string } | null {
	const match = content.match(FRONTMATTER_REGEX);
	if (!match) return null;
	return {
		frontmatter: match[1] ?? '',
		body: match[2] ?? '',
	};
}
