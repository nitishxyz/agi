export class CircularBuffer {
	private buffer: string[] = [];
	private maxSize: number;

	constructor(maxSize = 500) {
		this.maxSize = maxSize;
	}

	push(line: string): void {
		this.buffer.push(line);
		if (this.buffer.length > this.maxSize) {
			this.buffer.shift();
		}
	}

	read(lines?: number): string[] {
		if (lines === undefined) {
			return [...this.buffer];
		}
		return this.buffer.slice(-lines);
	}

	clear(): void {
		this.buffer = [];
	}

	get length(): number {
		return this.buffer.length;
	}
}
