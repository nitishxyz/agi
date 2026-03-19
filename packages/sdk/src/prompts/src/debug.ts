export function isDebugEnabled(flag?: string): boolean {
	void flag;
	return false;
}

type Timer = { end(meta?: Record<string, unknown>): void };

export function time(label: string): Timer {
	void label;
	return {
		end(meta?: Record<string, unknown>) {
			void meta;
		},
	};
}
