import { c } from './theme.ts';

let thinkingActive = false;

export function renderThinkingDelta(_delta: string): string {
	if (!thinkingActive) {
		thinkingActive = true;
		return `\n  ${c.fgDark('~')} ${c.fgDark(c.italic('thinking…'))}\n`;
	}
	return '';
}

export function renderThinkingEnd(): string {
	if (thinkingActive) {
		thinkingActive = false;
		return '';
	}
	return '';
}

export function isThinking(): boolean {
	return thinkingActive;
}
