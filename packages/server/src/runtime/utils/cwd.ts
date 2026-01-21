const cwdMap = new Map<string, string>();

export function getCwd(sessionId: string): string {
	return cwdMap.get(sessionId) ?? '.';
}

export function setCwd(sessionId: string, cwd: string) {
	cwdMap.set(sessionId, cwd || '.');
}

// normalize relative path like './a/../b' -> 'b', never escapes above '.'
export function normalizeRelative(path: string): string {
	const parts = path.replace(/\\/g, '/').split('/');
	const stack: string[] = [];
	for (const part of parts) {
		if (!part || part === '.') continue;
		if (part === '..') {
			if (stack.length > 0) stack.pop();
			continue;
		}
		stack.push(part);
	}
	return stack.length ? stack.join('/') : '.';
}

export function joinRelative(base: string, p: string): string {
	if (!p || p === '.') return base || '.';

	// Expand tilde to home directory if present
	const home = process.env.HOME || process.env.USERPROFILE || '';
	if (p === '~' && home) p = home;
	else if (p.startsWith('~/') && home) p = `${home}/${p.slice(2)}`;

	// If target is absolute, preserve it as absolute
	if (p.startsWith('/')) {
		// Canonicalize: collapse //, resolve . and .. without escaping above root
		const parts = p.replace(/\\/g, '/').split('/');
		const stack: string[] = [];
		for (const part of parts) {
			if (!part || part === '.') continue;
			if (part === '..') {
				if (stack.length > 0) stack.pop();
				continue;
			}
			stack.push(part);
		}
		return `/${stack.join('/')}` || '/';
	}

	// If base is absolute, join and return absolute
	const baseIsAbs = Boolean(base) && base.startsWith('/');
	if (baseIsAbs) {
		const joined = `${base.replace(/\/$/, '')}/${p}`;
		const parts = joined.replace(/\\/g, '/').split('/');
		const stack: string[] = [];
		for (const part of parts) {
			if (!part || part === '.') continue;
			if (part === '..') {
				if (stack.length > 0) stack.pop();
				continue;
			}
			stack.push(part);
		}
		return `/${stack.join('/')}` || '/';
	}

	// Relative -> Relative join
	return normalizeRelative(`${base || '.'}/${p}`);
}
