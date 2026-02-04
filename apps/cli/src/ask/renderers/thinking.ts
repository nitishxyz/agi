import { c, ICONS, truncate } from './theme.ts';

let thinkingActive = false;

export function renderThinkingDelta(delta: string): string {
	if (!thinkingActive) {
		thinkingActive = true;
		return `  ${c.dim(ICONS.spinner)} ${c.dim('thinking')} ${c.dim(ICONS.arrow)} ${c.dim(truncate(delta.trim(), 60))}`;
	}
	return '';
}

export function renderThinkingEnd(): string {
	if (thinkingActive) {
		thinkingActive = false;
	}
	return '';
}

export function isThinking(): boolean {
	return thinkingActive;
}
