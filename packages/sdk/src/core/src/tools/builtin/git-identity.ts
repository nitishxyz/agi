const OTTOCODE_BOT_USER_ID = '261994719';

export const OTTOCODE_BOT_NAME = 'ottocode-io[bot]';
export const OTTOCODE_BOT_EMAIL = `${OTTOCODE_BOT_USER_ID}+${OTTOCODE_BOT_NAME}@users.noreply.github.com`;
export const OTTOCODE_CO_AUTHOR = `Co-authored-by: ${OTTOCODE_BOT_NAME} <${OTTOCODE_BOT_EMAIL}>`;

export function appendCoAuthorTrailer(message: string): string {
	if (message.includes(OTTOCODE_CO_AUTHOR)) return message;
	return `${message}\n\n${OTTOCODE_CO_AUTHOR}`;
}

const GIT_COMMIT_MSG_RE =
	/git\s+commit\s+(?:[^"']*?)(?:-[a-z]*m|-m)\s+(["'])([\s\S]*?)\1/g;

export function injectCoAuthorIntoGitCommit(cmd: string): string {
	return cmd.replace(GIT_COMMIT_MSG_RE, (match, quote, msg) => {
		const patched = appendCoAuthorTrailer(msg);
		return match.replace(
			`${quote}${msg}${quote}`,
			`${quote}${patched}${quote}`,
		);
	});
}
