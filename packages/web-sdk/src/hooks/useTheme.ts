import { useEffect, useState, useCallback, useMemo } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'agi-theme';

function resolveInitialTheme(): Theme {
	if (typeof window === 'undefined') {
		return 'dark';
	}
	const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
	if (stored === 'light' || stored === 'dark') {
		return stored;
	}
	if (window.matchMedia?.('(prefers-color-scheme: light)').matches) {
		return 'light';
	}
	return 'dark';
}

export function useTheme() {
	const [theme, setTheme] = useState<Theme>(() => resolveInitialTheme());

	useEffect(() => {
		if (typeof document === 'undefined') return;

		const root = document.documentElement;
		if (theme === 'dark') {
			root.classList.add('dark');
		} else {
			root.classList.remove('dark');
		}

		try {
			window.localStorage.setItem(STORAGE_KEY, theme);
		} catch (error) {
			console.warn('Failed to persist theme preference', error);
		}

		if (window.parent && window.parent !== window) {
			window.parent.postMessage({ type: 'agi-set-theme', theme }, '*');
		}
	}, [theme]);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		const handler = (e: MessageEvent) => {
			if (
				e.data?.type === 'agi-set-theme' &&
				(e.data.theme === 'light' || e.data.theme === 'dark')
			) {
				setTheme(e.data.theme);
			}
		};
		window.addEventListener('message', handler);
		return () => window.removeEventListener('message', handler);
	}, []);

	// Memoize toggleTheme to prevent creating new function reference on every render
	const toggleTheme = useCallback(() => {
		setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
	}, []);

	// Return a stable object reference
	return useMemo(
		() => ({ theme, setTheme, toggleTheme }),
		[theme, toggleTheme],
	);
}

export type { Theme };
