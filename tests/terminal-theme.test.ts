import { describe, expect, test } from 'bun:test';
import { getTheme, themeList } from '@ottocode/themes';
import {
	GhosttyVtTerminal,
	loadGhosttyVt,
} from '../packages/web-sdk/src/lib/ghostty-vt';
import { InlineGhosttyTerminal } from '../packages/web-sdk/src/lib/inline-ghostty-terminal';
import {
	observeTerminalTheme,
	resolveTerminalTheme,
	TERMINAL_ANSI_COLORS,
} from '../packages/web-sdk/src/lib/terminal-theme';

const rgb = (hex: string) =>
	[1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));

async function createTerminal() {
	const bytes = await Bun.file(
		new URL(
			'../packages/web-sdk/src/assets/ghostty/ghostty-vt.wasm',
			import.meta.url,
		),
	).arrayBuffer();
	return new GhosttyVtTerminal(await loadGhosttyVt(bytes), 40, 4);
}

describe('terminal themes', () => {
	test('uses applied CSS colors and observes live root theme changes with cleanup', () => {
		const root = { dataset: { theme: 'otto-light' } };
		let notify = () => {};
		let disconnected = false;
		let removed = 0;
		const globals = {
			document: {
				documentElement: root,
				body: { appendChild() {} },
				createElement: () => ({ style: {}, remove: () => removed++ }),
			},
			getComputedStyle: (element: { className: string }) => ({
				backgroundColor:
					element.className === 'bg-accent'
						? 'rgb(220, 230, 240)'
						: 'rgb(250, 250, 250)',
				color:
					element.className === 'text-accent-foreground'
						? 'rgb(20, 30, 40)'
						: 'rgb(10, 20, 30)',
			}),
			MutationObserver: class {
				constructor(callback: () => void) {
					notify = callback;
				}
				observe(target: unknown, options: unknown) {
					expect(target).toBe(root);
					expect(options).toEqual({
						attributes: true,
						attributeFilter: ['data-theme', 'class', 'style'],
					});
				}
				disconnect() {
					disconnected = true;
				}
			},
		};
		const originals = Object.keys(globals).map(
			(key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
		);
		try {
			for (const [key, value] of Object.entries(globals))
				Object.defineProperty(globalThis, key, { configurable: true, value });
			const initial = resolveTerminalTheme();
			expect(initial.background).toBe('#fafafa');
			expect(initial.foreground).toBe('#0a141e');
			expect(initial.cursor).toBe('#0a141e');
			expect(initial.selectionBackground).toBe('#dce6f0');
			expect(initial.selectionForeground).toBe('#141e28');
			expect(initial.red).toBe(getTheme('otto-light').colors.red);
			let updated = initial;
			const stop = observeTerminalTheme((theme) => {
				updated = theme;
			});
			root.dataset.theme = 'otto-dark';
			notify();
			expect(updated.red).toBe(getTheme('otto-dark').colors.red);
			expect(removed).toBe(8);
			stop();
			expect(disconnected).toBe(true);
		} finally {
			for (const [key, descriptor] of originals) {
				if (descriptor) Object.defineProperty(globalThis, key, descriptor);
				else Reflect.deleteProperty(globalThis, key);
			}
		}
	});

	test('resolves complete light, dark, and named palettes', () => {
		for (const theme of themeList) {
			const resolved = resolveTerminalTheme(theme.id);
			expect(resolved.background).toBe(theme.colors.bg);
			expect(resolved.foreground).toBe(theme.colors.fg);
			expect(resolved.cursor).toBe(resolved.foreground);
			expect(resolved.cursorAccent).toBe(resolved.background);
			expect(resolved.selectionBackground).toBe(theme.colors.bgHighlight);
			expect(resolved.selectionForeground).toBe(theme.colors.fgBright);
			for (const key of TERMINAL_ANSI_COLORS)
				expect(resolved[key]).toMatch(/^#[\da-f]{6}$/i);
			expect(resolved.red).toBe(getTheme(theme.id).colors.red);
		}
		expect(resolveTerminalTheme('otto-light')).not.toEqual(
			resolveTerminalTheme('otto-dark'),
		);
	});

	test('recolors existing defaults and all ANSI cells without resetting terminal state', async () => {
		const terminal = await createTerminal();
		try {
			terminal.write('default ');
			for (let index = 0; index < 16; index++) {
				terminal.write(`\x1b[${index < 8 ? 30 + index : 90 + index - 8}mX`);
			}
			terminal.write('\x1b[0m\x1b[38;2;12;34;56mT\x1b[38;5;196mP\x1b[0m');
			const cursor = { ...terminal.getCursor() };
			const text = terminal.lineText(0);
			for (const id of ['otto-light', 'otto-dark', 'otto-light']) {
				const theme = resolveTerminalTheme(id);
				terminal.setTheme(theme);
				const line = terminal.getLine(0);
				if (!line) throw new Error('Expected terminal row');
				expect([line[0].fg_r, line[0].fg_g, line[0].fg_b]).toEqual(
					rgb(theme.foreground),
				);
				expect([line[0].bg_r, line[0].bg_g, line[0].bg_b]).toEqual(
					rgb(theme.background),
				);
				for (const [index, key] of TERMINAL_ANSI_COLORS.entries()) {
					const cell = line[8 + index];
					expect([cell.fg_r, cell.fg_g, cell.fg_b]).toEqual(rgb(theme[key]));
				}
				expect([line[24].fg_r, line[24].fg_g, line[24].fg_b]).toEqual([
					12, 34, 56,
				]);
				expect([line[25].fg_r, line[25].fg_g, line[25].fg_b]).toEqual([
					255, 0, 0,
				]);
				expect(terminal.lineText(0)).toBe(text);
				expect(terminal.getCursor()).toEqual(cursor);
			}
			terminal.write('\r\ncontinued');
			expect(terminal.lineText(1)).toBe('continued');
		} finally {
			terminal.free();
		}
	});

	test('preserves scrollback and OSC overrides across theme changes', async () => {
		const terminal = await createTerminal();
		try {
			terminal.write('\x1b]4;1;rgb:12/34/56\x07\x1b[31m');
			terminal.write(
				Array.from({ length: 20 }, (_, i) => `line ${i}\r\n`).join(''),
			);
			terminal.scroll(-3);
			const scrollbar = terminal.getScrollbar();
			const text = terminal.lineText(0);
			terminal.setTheme(resolveTerminalTheme('otto-light'));
			expect(terminal.getScrollbar()).toEqual(scrollbar);
			expect(terminal.lineText(0)).toBe(text);
			const cell = terminal.getLine(0)?.[0];
			if (!cell) throw new Error('Expected terminal cell');
			expect([cell.fg_r, cell.fg_g, cell.fg_b]).toEqual([18, 52, 86]);
		} finally {
			terminal.free();
		}
	});

	test('updates renderer, model, and custom cursor and forces repaint in place', () => {
		const calls: unknown[] = [];
		const terminal = {
			model: { setTheme: (theme: unknown) => calls.push(['model', theme]) },
			renderer: {
				setTheme: (theme: unknown) => calls.push(['renderer', theme]),
			},
			cursorColor: '',
			scheduleRender: (force: boolean) => calls.push(['paint', force]),
		};
		const theme = resolveTerminalTheme('otto-light');
		InlineGhosttyTerminal.prototype.setTheme.call(
			terminal as unknown as InlineGhosttyTerminal,
			theme,
		);
		expect(calls).toEqual([
			['model', theme],
			['renderer', theme],
			['paint', true],
		]);
		expect(terminal.cursorColor).toBe(theme.cursor);
	});
});
