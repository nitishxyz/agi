import { useEffect, useState } from 'react';

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

	const toggleTheme = () => {
		setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
	};

	return { theme, setTheme, toggleTheme } as const;
}

export type { Theme };
