import { useState, useCallback, useEffect } from 'react';
import { fetchJson } from '../api.ts';

interface Config {
	agents: string[];
	providers: string[];
	defaults: {
		agent: string;
		provider: string;
		model: string;
	};
}

export function useConfig() {
	const [config, setConfig] = useState<Config>({
		agents: [],
		providers: [],
		defaults: {
			agent: 'build',
			provider: 'anthropic',
			model: 'claude-sonnet-4-20250514',
		},
	});

	const loadConfig = useCallback(async () => {
		try {
			const data = await fetchJson<Config>('/v1/config');
			setConfig(data);
			return data;
		} catch {
			return config;
		}
	}, []);

	const updateDefaults = useCallback(
		async (changes: { provider?: string; model?: string; agent?: string }) => {
			try {
				const result = await fetchJson<{ defaults: Config['defaults'] }>(
					'/v1/config/defaults',
					{
						method: 'PATCH',
						body: JSON.stringify(changes),
					},
				);
				setConfig((prev) => ({ ...prev, defaults: result.defaults }));
			} catch {}
		},
		[],
	);

	useEffect(() => {
		loadConfig();
	}, [loadConfig]);

	return { config, loadConfig, updateDefaults };
}
