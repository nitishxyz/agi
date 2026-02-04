import { c, ICONS } from './theme.ts';

let thinkingActive = false;

export function renderThinkingDelta(delta: string): string {
	if (!thinkingActive) {
		thinkingActive = true;
		return `\n  ${c.dim.italic('thinking ···')}\n${c.dim(delta)}`;
	}
	return c.dim(delta);
}

export function renderThinkingEnd(): string {
	if (thinkingActive) {
		thinkingActive = false;
		return '\n';
	}
	return '';
}

export function isThinking(): boolean {
	return thinkingActive;
}
