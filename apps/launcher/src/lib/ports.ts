const COMMON_DEV_PORTS = [3000, 3001, 4000, 4200, 5173, 5174, 8000, 8080, 8081];

export function parseDevPorts(devPorts: string | undefined, apiPort: number): number[] {
	if (!devPorts || devPorts === 'auto') {
		const rangePorts: number[] = [];
		for (let p = apiPort + 10; p <= apiPort + 19; p++) {
			rangePorts.push(p);
		}
		return rangePorts;
	}

	const ports = new Set<number>();
	const parts = devPorts.split(',').map((s) => s.trim()).filter(Boolean);

	for (const part of parts) {
		if (part.includes('-')) {
			const [startStr, endStr] = part.split('-');
			const start = Number.parseInt(startStr.trim(), 10);
			const end = Number.parseInt(endStr.trim(), 10);
			if (!Number.isNaN(start) && !Number.isNaN(end) && start <= end && end - start <= 1000) {
				for (let p = start; p <= end; p++) {
					ports.add(p);
				}
			}
		} else {
			const p = Number.parseInt(part, 10);
			if (!Number.isNaN(p) && p > 0 && p <= 65535) {
				ports.add(p);
			}
		}
	}

	return [...ports].sort((a, b) => a - b);
}

export function formatDevPorts(ports: number[]): string {
	if (ports.length === 0) return '';

	const sorted = [...ports].sort((a, b) => a - b);
	const ranges: string[] = [];
	let start = sorted[0];
	let end = sorted[0];

	for (let i = 1; i < sorted.length; i++) {
		if (sorted[i] === end + 1) {
			end = sorted[i];
		} else {
			ranges.push(start === end ? `${start}` : `${start}-${end}`);
			start = sorted[i];
			end = sorted[i];
		}
	}
	ranges.push(start === end ? `${start}` : `${start}-${end}`);

	return ranges.join(', ');
}

export { COMMON_DEV_PORTS };
