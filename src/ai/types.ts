import type { z } from 'zod';

export interface ToolContext {
	projectRoot: string;
	// Consider adding db, logger etc. when integrated
}

export interface AITool<TParams = any, TResult = any> {
	name: string;
	description: string;
	parameters: z.ZodType<TParams>;
	execute: (args: TParams, ctx: ToolContext) => Promise<TResult>;
}
