import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useConfig, useUpdateDefaults } from './useConfig';

interface StoredPreferences {
	vimMode: boolean;
	compactThread: boolean;
}

interface Preferences extends StoredPreferences {
	fullWidthContent: boolean;
}

const STORAGE_KEY = 'otto-preferences';
const DEFAULT_STORED_PREFERENCES: StoredPreferences = {
	vimMode: false,
	compactThread: true,
};

function resolveInitialPreferences(): StoredPreferences {
	if (typeof window === 'undefined') {
		return DEFAULT_STORED_PREFERENCES;
	}
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored) as Partial<StoredPreferences>;
			return {
				vimMode:
					typeof parsed.vimMode === 'boolean'
						? parsed.vimMode
						: DEFAULT_STORED_PREFERENCES.vimMode,
				compactThread:
					typeof parsed.compactThread === 'boolean'
						? parsed.compactThread
						: DEFAULT_STORED_PREFERENCES.compactThread,
			};
		}
	} catch (error) {
		console.warn('Failed to load preferences', error);
	}
	return DEFAULT_STORED_PREFERENCES;
}

let preferences: StoredPreferences = resolveInitialPreferences();
const listeners = new Set<() => void>();

function getSnapshot(): StoredPreferences {
	return preferences;
}

function getServerSnapshot(): StoredPreferences {
	return DEFAULT_STORED_PREFERENCES;
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

function updateStore(updates: Partial<StoredPreferences>) {
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
	const { data: config } = useConfig();
	const updateDefaults = useUpdateDefaults();

	const updatePreferences = useCallback(
		(updates: Partial<Preferences>) => {
			const localUpdates: Partial<StoredPreferences> = {};

			if (updates.vimMode !== undefined) {
				localUpdates.vimMode = updates.vimMode;
			}
			if (updates.compactThread !== undefined) {
				localUpdates.compactThread = updates.compactThread;
			}

			if (Object.keys(localUpdates).length > 0) {
				updateStore(localUpdates);
			}

			if (
				updates.fullWidthContent !== undefined &&
				updates.fullWidthContent !== config?.defaults?.fullWidthContent
			) {
				updateDefaults.mutate({
					fullWidthContent: updates.fullWidthContent,
					scope: 'global',
				});
			}
		},
		[config?.defaults?.fullWidthContent, updateDefaults],
	);

	const resolvedPreferences = useMemo<Preferences>(
		() => ({
			...currentPreferences,
			fullWidthContent: config?.defaults?.fullWidthContent ?? false,
		}),
		[currentPreferences, config?.defaults?.fullWidthContent],
	);

	return useMemo(
		() => ({ preferences: resolvedPreferences, updatePreferences }),
		[resolvedPreferences, updatePreferences],
	);
}

export type { Preferences };
