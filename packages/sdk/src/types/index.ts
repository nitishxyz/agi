export type ExecutionContext = {
	projectRoot: string;
	workingDir?: string;
	env?: Record<string, string>;
};

export type ToolResult = {
	success: boolean;
	output?: string;
	error?: string;
};
