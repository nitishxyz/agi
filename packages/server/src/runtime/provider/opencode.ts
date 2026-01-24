import type { AGIConfig } from '@agi-cli/sdk';
import { createOpencodeModel } from '@agi-cli/sdk';

export function resolveOpencodeModel(model: string, _cfg: AGIConfig) {
	const apiKey = process.env.OPENCODE_API_KEY;
	return createOpencodeModel(model, { apiKey });
}
