import type { ProviderId } from '@agi-cli/providers';
import type { AskOptions } from './ask.ts';

// Compute final agent/provider/model for header display based on precedence:
// CLI opts > session header > chosen/config defaults
export function computeEffectiveContext(args: {
	ops: AskOptions;
	header: { agent?: string; provider?: string; model?: string };
	chosenProvider: ProviderId;
	chosenModel: string;
	defaultAgent: string;
}): { agent: string; provider: ProviderId; model: string } {
	const provider = (args.ops.provider ??
		args.header.provider ??
		args.chosenProvider) as ProviderId;
	const model = args.ops.model ?? args.header.model ?? args.chosenModel;
	const agent = args.ops.agent ?? args.header.agent ?? args.defaultAgent;
	return { agent, provider, model };
}
