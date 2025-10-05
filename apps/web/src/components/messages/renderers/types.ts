export interface ToolCallArgs {
	text?: string;
	message?: string;
	amend?: boolean;
	signoff?: boolean;
	pct?: number;
	stage?: string;
	all?: boolean;
	cmd?: string;
	cwd?: string;
	command?: string;
	script?: string;
	input?: string;
}

export interface ToolResultData {
	done?: boolean;
	text?: string;
	result?: string | Record<string, unknown>;
	ok?: boolean;
	message?: string;
	pct?: number;
	stage?: string;
	all?: boolean;
	patch?: string;
	staged?: number;
	unstaged?: number;
	raw?: string[];
	path?: string;
	content?: string;
	bytes?: number;
	opsApplied?: number;
	stdout?: string;
	stderr?: string;
	exitCode?: number;
	entries?: Array<{ name: string; type: string }>;
	tree?: string;
	matches?: unknown[];
	files?: unknown[];
	cwd?: string;
	output?: string;
	// Additional fields for specific renderers
	diff?: string; // for GitDiffRenderer
	summary?: string; // for GitStatusRenderer
	results?: unknown[]; // for WebSearchRenderer
}

export interface ContentJson {
	text?: string;
	name?: string;
	args?: ToolCallArgs;
	callId?: string;
	result?: ToolResultData;
	artifact?: {
		patch?: string;
		summary?: {
			files?: number;
			additions?: number;
			deletions?: number;
		};
	};
	// Additional fields for ErrorRenderer
	error?: Record<string, unknown>;
	details?: Record<string, unknown>;
	message?: string;
	type?: string;
	isAborted?: boolean;
}

export interface RendererProps {
	contentJson: ContentJson;
	toolDurationMs?: number;
	isExpanded: boolean;
	onToggle: () => void;
}

export interface GenericRendererProps extends RendererProps {
	toolName: string;
}
