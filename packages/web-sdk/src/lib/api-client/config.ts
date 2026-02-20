import {
	getConfig as apiGetConfig,
	getProviderModels as apiGetProviderModels,
	getAllModels as apiGetAllModels,
	updateDefaults as apiUpdateDefaults,
} from '@ottocode/api';
import type { AllModelsResponse } from '../../types/api';
import { extractErrorMessage } from './utils';

export const configMixin = {
	async getConfig(): Promise<{
		agents: string[];
		providers: string[];
		defaults: {
			agent: string;
			provider: string;
			model: string;
			toolApproval?: 'auto' | 'dangerous' | 'all';
			guidedMode?: boolean;
		};
	}> {
		const response = await apiGetConfig();
		if (response.error) throw new Error(extractErrorMessage(response.error));
		// biome-ignore lint/suspicious/noExplicitAny: API response structure
		return response.data as any;
	},

	async getModels(providerId: string): Promise<{
		models: Array<{ id: string; label: string; toolCall?: boolean }>;
		default: string;
	}> {
		const response = await apiGetProviderModels({
			// biome-ignore lint/suspicious/noExplicitAny: API type mismatch
			path: { provider: providerId as any },
		});
		if (response.error) throw new Error(extractErrorMessage(response.error));
		// biome-ignore lint/suspicious/noExplicitAny: API response structure
		return response.data as any;
	},

	async getAllModels(): Promise<AllModelsResponse> {
		const response = await apiGetAllModels();
		if (response.error) throw new Error(extractErrorMessage(response.error));
		return response.data as AllModelsResponse;
	},

	async updateDefaults(data: {
		agent?: string;
		provider?: string;
		model?: string;
		toolApproval?: 'auto' | 'dangerous' | 'all';
		guidedMode?: boolean;
		scope?: 'global' | 'local';
	}): Promise<{
		success: boolean;
		defaults: {
			agent: string;
			provider: string;
			model: string;
			toolApproval?: 'auto' | 'dangerous' | 'all';
			guidedMode?: boolean;
		};
	}> {
		const response = await apiUpdateDefaults({
			// biome-ignore lint/suspicious/noExplicitAny: API type mismatch
			body: data as any,
		});
		if (response.error) throw new Error(extractErrorMessage(response.error));
		// biome-ignore lint/suspicious/noExplicitAny: API response structure
		return response.data as any;
	},
};
