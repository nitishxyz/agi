import type { Command } from 'commander';
import { runShare } from '../share.ts';
import { ensureAuth } from '../middleware/with-auth.ts';

export interface ShareCommandOptions {
	project: string;
	title?: string;
	description?: string;
	until?: string;
	update?: boolean;
	delete?: boolean;
	status?: boolean;
	list?: boolean;
}

export async function handleShare(sessionId: string | undefined, opts: ShareCommandOptions) {
	if (!(await ensureAuth(opts.project))) return;

	await runShare({
		project: opts.project,
		sessionId,
		title: opts.title,
		description: opts.description,
		until: opts.until,
		update: opts.update,
		delete: opts.delete,
		status: opts.status,
		list: opts.list,
	});
}

export function registerShareCommand(program: Command) {
	program
		.command('share [sessionId]')
		.description('Share a session publicly')
		.option('--project <path>', 'Use project at <path>', process.cwd())
		.option('--title <title>', 'Custom title for the share')
		.option('--description <desc>', 'Description for OG preview')
		.option('--until <messageId>', 'Share only up to this message')
		.option('--update', 'Update an existing share with new messages')
		.option('--delete', 'Delete a shared session')
		.option('--status', 'Show share status for a session')
		.option('--list', 'List all shared sessions')
		.action(async (sessionId, opts) => {
			await handleShare(sessionId, {
				project: opts.project,
				title: opts.title,
				description: opts.description,
				until: opts.until,
				update: opts.update,
				delete: opts.delete,
				status: opts.status,
				list: opts.list,
			});
		});
}
