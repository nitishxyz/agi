import { useState } from 'react';
import type { ContentJson } from './types';
import { ReadRenderer } from './ReadRenderer';
import { WriteRenderer } from './WriteRenderer';
import { EditRenderer } from './EditRenderer';
import { BashRenderer } from './BashRenderer';
import { GitStatusRenderer } from './GitStatusRenderer';
import { GitDiffRenderer } from './GitDiffRenderer';
import { GitCommitRenderer } from './GitCommitRenderer';
import { ApplyPatchRenderer } from './ApplyPatchRenderer';
import { ListRenderer } from './ListRenderer';
import { TreeRenderer } from './TreeRenderer';
import { SearchRenderer } from './SearchRenderer';
import { FinishRenderer } from './FinishRenderer';
import { GenericRenderer } from './GenericRenderer';
import { DebugRenderer } from './DebugRenderer';
import { UpdatePlanRenderer } from './UpdatePlanRenderer';
import { ProgressUpdateRenderer } from './ProgressUpdateRenderer';
import { WebSearchRenderer } from './WebSearchRenderer';
import { ErrorRenderer } from './ErrorRenderer';

interface ToolResultRendererProps {
	toolName: string;
	contentJson: ContentJson;
	toolDurationMs?: number | null;
	debug?: boolean;
}

/**
 * Normalize tool names to canonical form for rendering.
 * Handles both snake_case (canonical) and PascalCase (OAuth) names.
 *
 * Claude Code OAuth requires PascalCase but doesn't whitelist tools,
 * so we can use all AGI tools with PascalCase naming.
 */
const TOOL_NAME_ALIASES: Record<string, string> = {
	// File system operations
	Read: 'read',
	Write: 'write',
	Edit: 'edit',
	Ls: 'ls',
	Tree: 'tree',
	Cd: 'cd',
	Pwd: 'pwd',

	// Search operations
	Glob: 'glob',
	Grep: 'ripgrep',

	// Execution
	Bash: 'bash',
	Terminal: 'terminal',

	// Git operations
	GitStatus: 'git_status',
	GitDiff: 'git_diff',
	GitCommit: 'git_commit',

	// Patch/edit
	ApplyPatch: 'apply_patch',

	// Task management
	UpdatePlan: 'update_plan',
	ProgressUpdate: 'progress_update',
	Finish: 'finish',

	// Web operations
	WebSearch: 'websearch',
};

function normalizeToolName(name: string): string {
	return TOOL_NAME_ALIASES[name] ?? name;
}

export function ToolResultRenderer({
	toolName,
	contentJson,
	toolDurationMs,
	debug,
}: ToolResultRendererProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const normalizedName = normalizeToolName(toolName);

	const props = {
		contentJson,
		toolDurationMs: toolDurationMs ?? undefined,
		isExpanded,
		onToggle: () => setIsExpanded(!isExpanded),
	};

	if (debug) {
		return <DebugRenderer {...props} toolName={toolName} />;
	}

	switch (normalizedName) {
		case 'read':
			return <ReadRenderer {...props} />;
		case 'write':
			return <WriteRenderer {...props} />;
		case 'edit':
			return <EditRenderer {...props} />;
		case 'bash':
			return <BashRenderer {...props} />;
		case 'git_status':
			return <GitStatusRenderer {...props} />;
		case 'git_diff':
			return <GitDiffRenderer {...props} />;
		case 'git_commit':
			return <GitCommitRenderer {...props} />;
		case 'apply_patch':
			return <ApplyPatchRenderer {...props} />;
		case 'ls':
			return <ListRenderer {...props} />;
		case 'tree':
			return <TreeRenderer {...props} />;
		case 'ripgrep':
		case 'grep':
		case 'glob':
			return <SearchRenderer {...props} />;
		case 'websearch':
			return <WebSearchRenderer {...props} />;
		case 'finish':
			return <FinishRenderer {...props} />;
		case 'update_plan':
			return <UpdatePlanRenderer {...props} />;
		case 'progress_update':
			return <ProgressUpdateRenderer {...props} />;
		case 'error':
			return <ErrorRenderer {...props} />;
		default:
			return <GenericRenderer {...props} toolName={toolName} />;
	}
}

export * from './types';
export { ReasoningRenderer } from './ReasoningRenderer';
