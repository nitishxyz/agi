import type { Hono } from 'hono';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { generateText, streamText } from 'ai';
import { eq } from 'drizzle-orm';
import type { ProviderId } from '@agi-cli/sdk';
import { loadConfig, getAuth, getFastModelForAuth } from '@agi-cli/sdk';
import { getDb } from '@agi-cli/database';
import { sessions } from '@agi-cli/database/schema';
import { gitCommitSchema, gitGenerateCommitMessageSchema } from './schemas.ts';
import { validateAndGetGitRoot, parseGitStatus } from './utils.ts';
import { resolveModel } from '../../runtime/provider/index.ts';
import { debugLog } from '../../runtime/debug/index.ts';
import {
	detectOAuth,
	adaptSimpleCall,
} from '../../runtime/provider/oauth-adapter.ts';

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
			const { project, sessionId } = gitGenerateCommitMessageSchema.parse(body);

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

			let provider = (config.defaults?.provider || 'anthropic') as ProviderId;

			if (sessionId) {
				const db = await getDb();
				const [session] = await db
					.select({ provider: sessions.provider })
					.from(sessions)
					.where(eq(sessions.id, sessionId));
				if (session?.provider) {
					provider = session.provider as ProviderId;
				}
			}

			const auth = await getAuth(provider, config.projectRoot);
			const oauth = detectOAuth(provider, auth);

			const modelId =
				getFastModelForAuth(provider, auth?.type) ??
				config.defaults?.model ??
				'claude-3-5-sonnet-20241022';
			const model = await resolveModel(provider, modelId, config);

			const userPrompt = `Generate a commit message for these git changes.

Staged files:
${fileList}

Diff (first 4000 chars):
${diff.slice(0, 4000)}

Guidelines:
- CAREFULLY READ the diff above - describe what ACTUALLY changed
- Use conventional commits format: type(scope): description
- First line under 72 characters
- Add a blank line, then 2-4 short bullet points
- Each bullet describes ONE specific change you see in the diff
- Be ACCURATE - don't invent changes that aren't in the diff
- Keep bullets short (under 80 chars each)
- Do not include markdown code blocks or backticks
- Return ONLY the commit message text, nothing else

Example (for a diff that adds boolean returns to functions):
refactor(auth): return success status from login functions

- Add boolean return type to auth functions
- Return false on user cancellation or failure
- Check return value before proceeding with auth flow

Commit message:`;

			const commitInstructions =
				'You are a helpful assistant that generates accurate git commit messages based on the actual diff content.';

			const adapted = adaptSimpleCall(oauth, {
				instructions: commitInstructions,
				userContent: userPrompt,
				maxOutputTokens: 500,
			});

			if (adapted.forceStream) {
				debugLog('[COMMIT] Using streamText for OpenAI OAuth');
				const result = streamText({
					model,
					system: adapted.system,
					messages: adapted.messages,
					providerOptions: adapted.providerOptions,
				});
				let text = '';
				for await (const chunk of result.textStream) {
					text += chunk;
				}
				const message = text.trim();
				debugLog(`[COMMIT] OAuth result: "${message.slice(0, 80)}..."`);
				return c.json({ status: 'ok', data: { message } });
			}

			const { text } = await generateText({
				model,
				system: adapted.system,
				messages: adapted.messages,
				maxOutputTokens: adapted.maxOutputTokens,
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
