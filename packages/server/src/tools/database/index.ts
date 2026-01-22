import { buildQuerySessionsTool } from './query-sessions.ts';
import { buildQueryMessagesTool } from './query-messages.ts';
import { buildGetSessionContextTool } from './get-session-context.ts';
import { buildSearchHistoryTool } from './search-history.ts';
import { buildGetParentSessionTool } from './get-parent-session.ts';
import { buildPresentActionTool } from './present-session-links.ts';

export type DatabaseTool =
	| ReturnType<typeof buildQuerySessionsTool>
	| ReturnType<typeof buildQueryMessagesTool>
	| ReturnType<typeof buildGetSessionContextTool>
	| ReturnType<typeof buildSearchHistoryTool>
	| ReturnType<typeof buildPresentActionTool>
	| ReturnType<typeof buildGetParentSessionTool>;

export function buildDatabaseTools(
	projectRoot: string,
	parentSessionId?: string | null,
): DatabaseTool[] {
	const tools: DatabaseTool[] = [
		buildQuerySessionsTool(projectRoot),
		buildQueryMessagesTool(projectRoot),
		buildGetSessionContextTool(projectRoot),
		buildSearchHistoryTool(projectRoot),
		buildPresentActionTool(),
	];

	if (parentSessionId) {
		tools.push(buildGetParentSessionTool(projectRoot, parentSessionId));
	}

	return tools;
}

export {
	buildQuerySessionsTool,
	buildQueryMessagesTool,
	buildGetSessionContextTool,
	buildSearchHistoryTool,
	buildGetParentSessionTool,
	buildPresentActionTool,
};
