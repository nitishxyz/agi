import { createHash } from 'node:crypto';
import type { MCPScope } from './types.ts';
import type { OAuthCredentialStore } from './oauth/store.ts';

export const GITHUB_COPILOT_HOSTS = [
	'api.githubcopilot.com',
	'copilot-proxy.githubusercontent.com',
];

export const COPILOT_MCP_REQUIRED_SCOPES = [
	'repo',
	'read:org',
	'gist',
	'notifications',
	'read:project',
	'security_events',
];

export const COPILOT_MCP_SCOPE =
	'repo read:org read:packages gist notifications read:project security_events';

/**
 * Returns whether a URL points at a GitHub Copilot-backed MCP endpoint.
 */
export function isGitHubCopilotUrl(url?: string): boolean {
	if (!url) return false;
	try {
		const parsed = new URL(url);
		return GITHUB_COPILOT_HOSTS.some(
			(host) =>
				parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
		);
	} catch {
		return false;
	}
}

/**
 * Returns whether the stored scope string satisfies the GitHub Copilot MCP requirements.
 */
export function hasCopilotMCPScopes(scopes?: string): boolean {
	if (!scopes) return false;
	const granted = scopes.split(/[\s,]+/).filter(Boolean);
	return COPILOT_MCP_REQUIRED_SCOPES.every((scope) => granted.includes(scope));
}

/**
 * Builds the MCP OAuth store key for a GitHub Copilot MCP server.
 */
export function getCopilotMCPOAuthKey(
	serverName: string,
	scope: MCPScope = 'global',
	projectRoot?: string,
): string {
	if (scope === 'project' && projectRoot) {
		const hash = createHash('sha256')
			.update(projectRoot)
			.digest('hex')
			.slice(0, 8);
		return `${serverName}_proj_${hash}`;
	}
	return serverName;
}

/**
 * Loads the stored GitHub Copilot MCP bearer token for a server.
 */
export async function getStoredCopilotMCPToken(
	store: OAuthCredentialStore,
	serverName: string,
	scope: MCPScope = 'global',
	projectRoot?: string,
): Promise<{ token: string | null; needsReauth: boolean; scopes?: string }> {
	const tokens = await store.loadTokens(
		getCopilotMCPOAuthKey(serverName, scope, projectRoot),
	);
	const token = tokens?.access_token ?? null;
	if (!token) {
		return { token: null, needsReauth: true };
	}
	return {
		token,
		needsReauth: !hasCopilotMCPScopes(tokens?.scope),
		scopes: tokens?.scope,
	};
}

/**
 * Returns whether the stored GitHub Copilot MCP credentials are usable.
 */
export async function isStoredCopilotMCPAuthenticated(
	store: OAuthCredentialStore,
	serverName: string,
	scope: MCPScope = 'global',
	projectRoot?: string,
): Promise<boolean> {
	const { token, needsReauth } = await getStoredCopilotMCPToken(
		store,
		serverName,
		scope,
		projectRoot,
	);
	return !!token && !needsReauth;
}
