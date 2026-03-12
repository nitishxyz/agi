import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import {
	COPILOT_MCP_SCOPE,
	OAuthCredentialStore,
	getCopilotMCPOAuthKey,
	getStoredCopilotMCPToken,
	hasCopilotMCPScopes,
	isGitHubCopilotUrl,
	isStoredCopilotMCPAuthenticated,
} from '@ottocode/sdk';

describe('GitHub Copilot MCP auth helpers', () => {
	test('matches GitHub Copilot MCP hosts', () => {
		expect(isGitHubCopilotUrl('https://api.githubcopilot.com/mcp/')).toBe(true);
		expect(
			isGitHubCopilotUrl(
				'https://copilot-proxy.githubusercontent.com/v1/agents/mcp',
			),
		).toBe(true);
		expect(isGitHubCopilotUrl('https://github.com/login/device')).toBe(false);
	});

	test('keys project-scoped Copilot MCP credentials separately', () => {
		const globalKey = getCopilotMCPOAuthKey('github', 'global', '/repo');
		const projectKey = getCopilotMCPOAuthKey('github', 'project', '/repo');

		expect(globalKey).toBe('github');
		expect(projectKey).toStartWith('github_proj_');
		expect(projectKey).not.toBe(globalKey);
	});

	test('loads MCP token state from the MCP OAuth store', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'otto-mcp-copilot-'));
		const store = new OAuthCredentialStore(dir);
		const serverName = 'github';
		const projectRoot = '/repo';

		try {
			await store.saveTokens(
				getCopilotMCPOAuthKey(serverName, 'project', projectRoot),
				{
					access_token: 'copilot-mcp-token',
					scope: COPILOT_MCP_SCOPE,
				},
			);

			const stored = await getStoredCopilotMCPToken(
				store,
				serverName,
				'project',
				projectRoot,
			);

			expect(stored.token).toBe('copilot-mcp-token');
			expect(stored.needsReauth).toBe(false);
			expect(hasCopilotMCPScopes(stored.scopes)).toBe(true);
			expect(
				await isStoredCopilotMCPAuthenticated(
					store,
					serverName,
					'project',
					projectRoot,
				),
			).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
