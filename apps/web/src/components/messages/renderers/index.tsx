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

interface ToolResultRendererProps {
	toolName: string;
	contentJson: ContentJson;
	toolDurationMs?: number | null;
	debug?: boolean;
}

export function ToolResultRenderer({
	toolName,
	contentJson,
	toolDurationMs,
	debug,
}: ToolResultRendererProps) {
	const [isExpanded, setIsExpanded] = useState(false);

	const props = {
		contentJson,
		toolDurationMs: toolDurationMs ?? undefined,
		isExpanded,
		onToggle: () => setIsExpanded(!isExpanded),
	};

	if (debug) {
		return <DebugRenderer {...props} toolName={toolName} />;
	}

	switch (toolName) {
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
		case 'finish':
			return <FinishRenderer {...props} />;
		case 'update_plan':
			return <UpdatePlanRenderer {...props} />;
		default:
			return <GenericRenderer {...props} toolName={toolName} />;
	}
}

export * from './types';
