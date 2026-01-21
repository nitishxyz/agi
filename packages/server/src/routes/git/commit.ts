import type { Hono } from 'hono';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { generateText } from 'ai';
import type { ProviderId } from '@agi-cli/sdk';
import { loadConfig, getAuth, getFastModelForAuth } from '@agi-cli/sdk';
import { gitCommitSchema, gitGenerateCommitMessageSchema } from './schemas.ts';
import { validateAndGetGitRoot, parseGitStatus } from './utils.ts';
import { resolveModel } from '../../runtime/provider/index.ts';
import { getProviderSpoofPrompt } from '../../runtime/prompt/builder.ts';

const execFileAsync = promisify(execFile);

export function registerCommitRoutes(app: Hono) {
	app.post('/v1/git/commit', async (c) => {
		try {
			const body = await c.req.json();
			const { message, project } = gitCommitSchema.parse(body);

			const requestedPath = project || process.cwd();

			const validation = await validateAndGetGitRoot(requestedPath);
			if ('error' in validation) {
				return c.json(
					{ status: 'error', error: validation.error, code: validation.code },
					400,
				);
			}

			const { gitRoot } = validation;

			const { stdout } = await execFileAsync('git', ['commit', '-m', message], {
				cwd: gitRoot,
			});

			return c.json({
				status: 'ok',
				data: {
					message: stdout.trim(),
				},
			});
		} catch (error) {
			return c.json(
				{
					status: 'error',
					error: error instanceof Error ? error.message : 'Failed to commit',
				},
				500,
			);
		}
	});

	app.post('/v1/git/generate-commit-message', async (c) => {
		try {
			const body = await c.req.json();
			const { project } = gitGenerateCommitMessageSchema.parse(body);

			const requestedPath = project || process.cwd();

			const validation = await validateAndGetGitRoot(requestedPath);
			if ('error' in validation) {
				return c.json(
					{ status: 'error', error: validation.error, code: validation.code },
					400,
				);
			}

			const { gitRoot } = validation;

			const { stdout: diff } = await execFileAsync(
				'git',
				['diff', '--cached'],
				{
					cwd: gitRoot,
				},
			);

			if (!diff.trim()) {
				return c.json(
					{
						status: 'error',
						error: 'No staged changes to generate message from',
					},
					400,
				);
			}

			const { stdout: statusOutput } = await execFileAsync(
				'git',
				['status', '--porcelain=v2'],
				{ cwd: gitRoot },
			);
			const { staged } = parseGitStatus(statusOutput, gitRoot);
			const fileList = staged.map((f) => `${f.status}: ${f.path}`).join('\n');

			const config = await loadConfig();

			const provider = (config.defaults?.provider || 'anthropic') as ProviderId;

			const auth = await getAuth(provider, config.projectRoot);
			const needsSpoof = auth?.type === 'oauth';
			const spoofPrompt = needsSpoof
				? getProviderSpoofPrompt(provider)
				: undefined;

			const modelId =
				getFastModelForAuth(provider, auth?.type) ??
				config.defaults?.model ??
				'claude-3-5-sonnet-20241022';
			const model = await resolveModel(provider, modelId, config);

			const userPrompt = `Generate a concise, conventional commit message for these git changes.

Staged files:
${fileList}

Diff (first 2000 chars):
${diff.slice(0, 2000)}

Guidelines:
- Use conventional commits format (feat:, fix:, docs:, etc.)
- Keep the first line under 72 characters
- Be specific but concise
- Focus on what changed and why, not how
- Do not include any markdown formatting or code blocks
- Return ONLY the commit message text, nothing else

Commit message:`;

			const systemPrompt = spoofPrompt
				? spoofPrompt
				: 'You are a helpful assistant that generates git commit messages.';

			const { text } = await generateText({
				model,
				system: systemPrompt,
				prompt: userPrompt,
				maxTokens: 200,
			});

			const message = text.trim();

			return c.json({
				status: 'ok',
				data: {
					message,
				},
			});
		} catch (error) {
			return c.json(
				{
					status: 'error',
					error:
						error instanceof Error
							? error.message
							: 'Failed to generate commit message',
				},
				500,
			);
		}
	});
}
