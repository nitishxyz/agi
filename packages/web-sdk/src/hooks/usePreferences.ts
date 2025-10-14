import { useEffect, useState, useCallback, useMemo } from 'react';

interface Preferences {
	vimMode: boolean;
}

const STORAGE_KEY = 'agi-preferences';
const DEFAULT_PREFERENCES: Preferences = {
	vimMode: false,
};

function resolveInitialPreferences(): Preferences {
	if (typeof window === 'undefined') {
		return DEFAULT_PREFERENCES;
	}
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored) as Partial<Preferences>;
			return {
				...DEFAULT_PREFERENCES,
				...parsed,
			};
		}
	} catch (error) {
		console.warn('Failed to load preferences', error);
	}
	return DEFAULT_PREFERENCES;
}

export function usePreferences() {
	const [preferences, setPreferences] = useState<Preferences>(() =>
		resolveInitialPreferences(),
	);

	useEffect(() => {
		if (typeof window === 'undefined') return;

		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
		} catch (error) {
			console.warn('Failed to persist preferences', error);
		}
	}, [preferences]);

	const updatePreferences = useCallback((updates: Partial<Preferences>) => {
		setPreferences((prev) => ({ ...prev, ...updates }));
	}, []);

	return useMemo(
		() => ({ preferences, updatePreferences }),
		[preferences, updatePreferences],
	);
}

export type { Preferences };
