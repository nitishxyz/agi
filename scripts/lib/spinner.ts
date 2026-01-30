const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const CLEAR_LINE = '\x1b[2K\r';

export { GREEN, DIM, BOLD, RED, YELLOW, CYAN, RESET };

function formatElapsed(ms: number): string {
	const s = ms / 1000;
	if (s < 60) return `${s.toFixed(1)}s`;
	const m = Math.floor(s / 60);
	const rem = s % 60;
	return `${m}m ${rem.toFixed(0)}s`;
}

export class Spinner {
	private frame = 0;
	private timer: ReturnType<typeof setInterval> | null = null;
	private label = '';
	private start = 0;

	begin(msg: string) {
		this.label = msg;
		this.frame = 0;
		this.start = performance.now();
		process.stdout.write(HIDE_CURSOR);
		this.render();
		this.timer = setInterval(() => this.render(), 80);
	}

	private render() {
		const elapsed = formatElapsed(performance.now() - this.start);
		const f = FRAMES[this.frame % FRAMES.length];
		process.stdout.write(
			`${CLEAR_LINE}  ${CYAN}${f}${RESET} ${this.label} ${DIM}${elapsed}${RESET}`,
		);
		this.frame++;
	}

	succeed(extra?: string) {
		this.stop();
		const elapsed = formatElapsed(performance.now() - this.start);
		const suffix = extra ? ` ${DIM}${extra}${RESET}` : '';
		process.stdout.write(
			`${CLEAR_LINE}  ${GREEN}✓${RESET} ${this.label} ${DIM}${elapsed}${RESET}${suffix}\n`,
		);
		process.stdout.write(SHOW_CURSOR);
	}

	fail(extra?: string) {
		this.stop();
		const suffix = extra ? ` ${DIM}${extra}${RESET}` : '';
		process.stdout.write(
			`${CLEAR_LINE}  ${RED}✗${RESET} ${this.label}${suffix}\n`,
		);
		process.stdout.write(SHOW_CURSOR);
	}

	private stop() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}
}
