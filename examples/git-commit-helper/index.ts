#!/usr/bin/env bun

/**
 * Git Commit Helper
 *
 * Analyzes git diffs and generates conventional commit messages using AI.
 *
 * Usage:
 *   bun run index.ts              # Analyze and suggest commit
 *   bun run index.ts --dry-run    # Just show suggestion, don't prompt
 */

import { generateObject, resolveModel } from '@agi-cli/sdk';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Schema for structured commit message
const CommitMessageSchema = z.object({
	type: z.enum([
		'feat',
		'fix',
		'docs',
		'style',
		'refactor',
		'perf',
		'test',
		'build',
		'ci',
		'chore',
	]),
	scope: z.string().optional().describe('Component or area affected'),
	subject: z.string().describe('Brief summary (max 50 chars)'),
	body: z.string().optional().describe('Detailed explanation'),
	breaking: z.boolean().describe('Does this include breaking changes?'),
	breakingDescription: z
		.string()
		.optional()
		.describe('Description of breaking changes'),
});

type CommitMessage = z.infer<typeof CommitMessageSchema>;

async function getGitDiff(): Promise<string> {
	try {
		// Try staged changes first
		const { stdout: staged } = await execAsync('git diff --staged');
		if (staged.trim()) {
			return staged;
		}

		// Fall back to unstaged changes
		const { stdout: unstaged } = await execAsync('git diff');
		if (unstaged.trim()) {
			console.log(
				'ℹ️  No staged changes found, analyzing unstaged changes...\n',
			);
			return unstaged;
		}

		throw new Error(
			'No changes found. Stage some changes with `git add` or make some changes.',
		);
	} catch (error) {
		throw new Error(`Failed to get git diff: ${error.message}`);
	}
}

function formatCommitMessage(commit: CommitMessage): string {
	let message = commit.type;

	if (commit.scope) {
		message += `(${commit.scope})`;
	}

	message += `: ${commit.subject}`;

	if (commit.body) {
		message += `\n\n${commit.body}`;
	}

	if (commit.breaking && commit.breakingDescription) {
		message += `\n\nBREAKING CHANGE: ${commit.breakingDescription}`;
	}

	return message;
}

async function main() {
	const dryRun = process.argv.includes('--dry-run');

	console.log('🔍 Analyzing git diff...\n');

	try {
		// Get the diff
		const diff = await getGitDiff();

		if (diff.length > 10000) {
			console.warn(
				'⚠️  Warning: Diff is very large, this may take a moment...\n',
			);
		}

		// Resolve model
		const provider = (process.env.PROVIDER || 'anthropic') as any;
		const modelId = process.env.MODEL || 'claude-sonnet-4';
		const model = await resolveModel(provider, modelId);

		// Generate commit message
		const result = await generateObject({
			model,
			schema: CommitMessageSchema,
			prompt: `Analyze this git diff and generate a conventional commit message.

Rules:
- Choose the most appropriate type (feat, fix, docs, etc.)
- Keep subject line under 50 characters
- Use imperative mood ("add" not "added")
- Scope should be a single word if possible
- Body should explain WHY, not just WHAT
- Mark as breaking if it changes existing APIs or behavior

Git diff:
\`\`\`
${diff}
\`\`\`
`,
			temperature: 0.3,
		});

		const commit = result.object;
		const message = formatCommitMessage(commit);

		// Display the suggestion
		console.log('📝 Suggested commit message:\n');
		console.log('─'.repeat(50));
		console.log(message);
		console.log('─'.repeat(50));

		if (commit.breaking) {
			console.log('\n⚠️  This commit includes BREAKING CHANGES');
		}

		// In dry-run mode, just exit
		if (dryRun) {
			process.exit(0);
		}

		// Prompt user to create commit
		console.log('\n❓ Would you like to create this commit? (y/n)');

		const answer = await new Promise<string>((resolve) => {
			process.stdin.once('data', (data) => {
				resolve(data.toString().trim().toLowerCase());
			});
		});

		if (answer === 'y' || answer === 'yes') {
			// Create the commit
			await execAsync(`git commit -m "${message.replace(/"/g, '\\"')}"`);
			console.log('\n✅ Commit created successfully!');
		} else {
			console.log('\n❌ Commit cancelled');
		}
	} catch (error) {
		console.error('Error:', error.message);
		process.exit(1);
	}
}

main();
