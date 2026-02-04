import { useCallback, useMemo, useSyncExternalStore } from 'react';

interface Preferences {
	vimMode: boolean;
	reasoningEnabled: boolean;
}

const STORAGE_KEY = 'otto-preferences';
const DEFAULT_PREFERENCES: Preferences = {
	vimMode: false,
	reasoningEnabled: true,
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

let preferences: Preferences = resolveInitialPreferences();
const listeners = new Set<() => void>();

function getSnapshot(): Preferences {
	return preferences;
}

function getServerSnapshot(): Preferences {
	return DEFAULT_PREFERENCES;
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function notifyListeners() {
	for (const listener of listeners) {
		listener();
	}
}

function updateStore(updates: Partial<Preferences>) {
	preferences = { ...preferences, ...updates };
	if (typeof window !== 'undefined') {
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
		} catch (error) {
			console.warn('Failed to persist preferences', error);
		}
	}
	notifyListeners();
}

export function usePreferences() {
	const currentPreferences = useSyncExternalStore(
		subscribe,
		getSnapshot,
		getServerSnapshot,
	);

	const updatePreferences = useCallback((updates: Partial<Preferences>) => {
		updateStore(updates);
	}, []);

	return useMemo(
		() => ({ preferences: currentPreferences, updatePreferences }),
		[currentPreferences, updatePreferences],
	);
}

export type { Preferences };
