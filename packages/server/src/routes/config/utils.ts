import {
	catalog,
	type ProviderId,
	isProviderAuthorized,
	getGlobalAgentsDir,
} from '@agi-cli/sdk';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { EmbeddedAppConfig } from '../../index.ts';
import type { AGIConfig } from '@agi-cli/sdk';
import { logger } from '@agi-cli/sdk';
import { loadAgentsConfig } from '../../runtime/agent/registry.ts';

export async function isProviderAuthorizedHybrid(
	embeddedConfig: EmbeddedAppConfig | undefined,
	fileConfig: AGIConfig,
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
	fileConfig: AGIConfig,
): Promise<ProviderId[]> {
	const allProviders = Object.keys(catalog) as ProviderId[];
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

export function getDefault<T>(
	embeddedValue: T | undefined,
	embeddedDefaultValue: T | undefined,
	fileValue: T,
): T {
	return embeddedValue ?? embeddedDefaultValue ?? fileValue;
}

export async function discoverAllAgents(
	projectRoot: string,
): Promise<string[]> {
	const builtInAgents = ['general', 'build', 'plan'];
	const agentSet = new Set<string>(builtInAgents);

	try {
		const agentsJson = await loadAgentsConfig(projectRoot);
		for (const agentName of Object.keys(agentsJson)) {
			if (agentName.trim()) {
				agentSet.add(agentName);
			}
		}
	} catch (err) {
		logger.debug('Failed to load agents.json', err);
	}

	try {
		const localAgentsPath = join(projectRoot, '.agi', 'agents');
		const localFiles = await readdir(localAgentsPath).catch(() => []);
		for (const file of localFiles) {
			if (file.endsWith('.txt') || file.endsWith('.md')) {
				const agentName = file.replace(/\.(txt|md)$/, '');
				if (agentName.trim()) {
					agentSet.add(agentName);
				}
			}
		}
	} catch (err) {
		logger.debug('Failed to read local agents directory', err);
	}

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
	} catch (err) {
		logger.debug('Failed to read global agents directory', err);
	}

	return Array.from(agentSet).sort();
}
