import type { Tool } from 'ai';
import { buildReadTool } from './read.ts';
import { buildWriteTool } from './write.ts';
import { buildLsTool } from './ls.ts';
import { buildTreeTool } from './tree.ts';
import { buildPwdTool } from './pwd.ts';
import { buildCdTool } from './cd.ts';

export function buildFsTools(
	projectRoot: string,
): Array<{ name: string; tool: Tool }> {
	const out: Array<{ name: string; tool: Tool }> = [];
	out.push(buildReadTool(projectRoot));
	out.push(buildWriteTool(projectRoot));
	out.push(buildLsTool(projectRoot));
	out.push(buildTreeTool(projectRoot));
	out.push(buildPwdTool());
	out.push(buildCdTool());
	return out;
}
