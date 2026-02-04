import type { Artifact } from '@ottocode/sdk';

export type ToolCallArgs = Record<string, unknown>;
export type ToolResultData = Record<string, unknown>;

export interface ContentJson {
	args?: ToolCallArgs;
	result?: ToolResultData;
	artifact?: {
		kind?: string;
		patch?: string;
		summary?: {
			files?: number;
			additions?: number;
			deletions?: number;
		};
	};
}

export interface RendererContext {
	toolName: string;
	args?: unknown;
	result?: unknown;
	artifact?: Artifact;
	durationMs?: number;
	error?: string;
	verbose?: boolean;
}
