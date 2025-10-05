import { useEffect, useState, useCallback, useMemo } from 'react';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'agi-theme';
const DEFAULT_THEME: Theme = 'dark';

function resolveInitialTheme(): Theme {
	if (typeof window === 'undefined') {
		return DEFAULT_THEME;
	}
	const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
	if (stored === 'light' || stored === 'dark') {
		return stored;
	}
	return DEFAULT_THEME;
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
	}, [theme]);

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
