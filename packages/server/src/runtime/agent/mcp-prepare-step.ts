import type { Tool } from 'ai';
import { debugLog } from '../debug/index.ts';

export interface MCPPrepareStepState {
	mcpToolsRecord: Record<string, Tool>;
	loadedMCPTools: Set<string>;
	baseToolNames: string[];
	canonicalToRegistration: Record<string, string>;
	loadToolRegistrationName: string;
}

export function createMCPPrepareStepState(
	mcpToolsRecord: Record<string, Tool>,
	baseToolNames: string[],
	canonicalToRegistration: Record<string, string>,
	loadToolRegistrationName: string,
): MCPPrepareStepState {
	return {
		mcpToolsRecord,
		loadedMCPTools: new Set(),
		baseToolNames,
		canonicalToRegistration,
		loadToolRegistrationName,
	};
}

export function buildPrepareStep(state: MCPPrepareStepState) {
	return async ({
		stepNumber,
		steps,
	}: {
		stepNumber: number;
		steps: unknown[];
	}) => {
		const previousSteps = steps as Array<{
			toolCalls?: Array<{ toolName: string; input: unknown }>;
			toolResults?: Array<{ toolName: string; output: unknown }>;
		}>;

		for (const step of previousSteps) {
			if (!step.toolCalls) continue;
			for (const call of step.toolCalls) {
				if (call.toolName !== state.loadToolRegistrationName) continue;
				const result = (step.toolResults ?? []).find(
					(r) => r.toolName === state.loadToolRegistrationName,
				);
				const output = result?.output as { loaded?: string[] } | undefined;
				if (!output?.loaded) continue;
				for (const canonicalName of output.loaded) {
					const regName =
						state.canonicalToRegistration[canonicalName] ?? canonicalName;
					if (!state.loadedMCPTools.has(regName)) {
						state.loadedMCPTools.add(regName);
					}
				}
			}
		}

		const activeTools = [...state.baseToolNames, ...state.loadedMCPTools];

		if (state.loadedMCPTools.size > 0) {
			debugLog(
				`[MCP prepareStep] step=${stepNumber}, active MCP tools: ${[...state.loadedMCPTools].join(', ')}`,
			);
		}

		return { activeTools };
	};
}
