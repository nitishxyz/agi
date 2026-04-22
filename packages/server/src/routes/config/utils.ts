import {
	getConfiguredProviderApiKey,
	getConfiguredProviderIds,
	getConfiguredProviderModels,
	getProviderDefinition,
	getProviderSettings,
	type ProviderId,
	isProviderAuthorized,
	getGlobalAgentsDir,
	getAuth,
} from '@ottocode/sdk';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { EmbeddedAppConfig } from '../../index.ts';
import type { OttoConfig } from '@ottocode/sdk';
import { loadAgentsConfig } from '../../runtime/agent/registry.ts';

export type ProviderDetail = {
	id: string;
	label: string;
	source: 'built-in' | 'custom';
	enabled: boolean;
	authorized: boolean;
	custom: boolean;
	compatibility?: string;
	family?: string;
	baseURL?: string;
	apiKeyEnv?: string;
	hasApiKey: boolean;
	allowAnyModel: boolean;
	modelCount: number;
	authType?: 'api' | 'oauth' | 'wallet';
};

export async function isProviderAuthorizedHybrid(
	embeddedConfig: EmbeddedAppConfig | undefined,
	fileConfig: OttoConfig,
	provider: ProviderId,
): Promise<boolean> {
	const hasEmbeddedAuth =
		embeddedConfig?.provider === provider ||
		(embeddedConfig?.auth && provider in embeddedConfig.auth);

	if (hasEmbeddedAuth) {
		return true;
	}

	return await isProviderAuthorized(fileConfig, provider);
}

export async function getAuthorizedProviders(
	embeddedConfig: EmbeddedAppConfig | undefined,
	fileConfig: OttoConfig,
): Promise<ProviderId[]> {
	const allProviders = getConfiguredProviderIds(fileConfig);
	const authorizedProviders: ProviderId[] = [];

	for (const provider of allProviders) {
		const authorized = await isProviderAuthorizedHybrid(
			embeddedConfig,
			fileConfig,
			provider,
		);
		if (authorized) {
			authorizedProviders.push(provider);
		}
	}

	return authorizedProviders;
}

export async function getProviderDetails(
	embeddedConfig: EmbeddedAppConfig | undefined,
	fileConfig: OttoConfig,
): Promise<ProviderDetail[]> {
	const providers = Array.from(
		new Set<ProviderId>([
			...getConfiguredProviderIds(fileConfig, { includeDisabled: true }),
			...(embeddedConfig?.provider ? [embeddedConfig.provider] : []),
			...((embeddedConfig?.auth
				? (Object.keys(embeddedConfig.auth) as ProviderId[])
				: []) as ProviderId[]),
		]),
	);
	const details = await Promise.all(
		providers.map(async (provider) => {
			const definition = getProviderDefinition(fileConfig, provider);
			if (!definition) return null;
			const settings = getProviderSettings(fileConfig, provider);
			const authorized = await isProviderAuthorizedHybrid(
				embeddedConfig,
				fileConfig,
				provider,
			);
			const authType = await getAuthTypeForProvider(
				embeddedConfig,
				provider,
				fileConfig.projectRoot,
			);
			return {
				id: provider,
				label: definition.label,
				source: definition.source,
				enabled: settings?.enabled !== false,
				authorized,
				custom: definition.source === 'custom',
				compatibility: definition.compatibility,
				family: definition.family,
				baseURL: definition.baseURL,
				apiKeyEnv: definition.apiKeyEnv,
				hasApiKey: Boolean(getConfiguredProviderApiKey(fileConfig, provider)),
				allowAnyModel: definition.allowAnyModel,
				modelCount: getConfiguredProviderModels(fileConfig, provider).length,
				authType,
			} satisfies ProviderDetail;
		}),
	);
	return details.filter((detail): detail is ProviderDetail => Boolean(detail));
}

export function getDefault<T>(
	embeddedValue: T | undefined,
	embeddedDefaultValue: T | undefined,
	fileValue: T,
): T {
	return embeddedValue ?? embeddedDefaultValue ?? fileValue;
}

export async function getAuthTypeForProvider(
	embeddedConfig: EmbeddedAppConfig | undefined,
	provider: ProviderId,
	projectRoot: string,
): Promise<'api' | 'oauth' | 'wallet' | undefined> {
	if (embeddedConfig?.auth?.[provider]) {
		const embeddedAuth = embeddedConfig.auth[provider];
		return 'type' in embeddedAuth ? embeddedAuth.type : 'api';
	}
	const auth = await getAuth(provider, projectRoot);
	return auth?.type as 'api' | 'oauth' | 'wallet' | undefined;
}

export async function discoverAllAgents(
	projectRoot: string,
): Promise<string[]> {
	const builtInAgents = ['general', 'build', 'plan', 'init'];
	const agentSet = new Set<string>(builtInAgents);

	try {
		const agentsJson = await loadAgentsConfig(projectRoot);
		for (const agentName of Object.keys(agentsJson)) {
			if (agentName.trim()) {
				agentSet.add(agentName);
			}
		}
	} catch {}

	try {
		const localAgentsPath = join(projectRoot, '.otto', 'agents');
		const localFiles = await readdir(localAgentsPath).catch(() => []);
		for (const file of localFiles) {
			if (file.endsWith('.txt') || file.endsWith('.md')) {
				const agentName = file.replace(/\.(txt|md)$/, '');
				if (agentName.trim()) {
					agentSet.add(agentName);
				}
			}
		}
	} catch {}

	try {
		const globalAgentsPath = getGlobalAgentsDir();
		const globalFiles = await readdir(globalAgentsPath).catch(() => []);
		for (const file of globalFiles) {
			if (file.endsWith('.txt') || file.endsWith('.md')) {
				const agentName = file.replace(/\.(txt|md)$/, '');
				if (agentName.trim()) {
					agentSet.add(agentName);
				}
			}
		}
	} catch {}

	return Array.from(agentSet).sort();
}
