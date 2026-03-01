import { useState, useCallback, useEffect } from 'react';
import { getConfig, updateDefaults as apiUpdateDefaults } from '@ottocode/api';

interface Config {
	agents: string[];
	providers: string[];
	defaults: {
		agent: string;
		provider: string;
		model: string;
		reasoningText?: boolean;
		theme?: string;
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
			reasoningText: true,
		},
	});

	const loadConfig = useCallback(async () => {
		try {
			const response = await getConfig();
			const data = response.data as unknown as Config;
			if (data) setConfig(data);
			return data ?? config;
		} catch {
			return config;
		}
	}, [config]);

	const updateDefaults = useCallback(
		async (changes: {
			provider?: string;
			model?: string;
			agent?: string;
			reasoningText?: boolean;
			theme?: string;
		}) => {
			try {
				const response = await apiUpdateDefaults({
					body: changes,
				});
				const result = response.data as unknown as {
					defaults: Config['defaults'];
				};
				if (result?.defaults) {
					setConfig((prev) => ({ ...prev, defaults: result.defaults }));
				}
			} catch {}
		},
		[],
	);

	useEffect(() => {
		loadConfig();
	}, [loadConfig]);

	return { config, loadConfig, updateDefaults };
}
