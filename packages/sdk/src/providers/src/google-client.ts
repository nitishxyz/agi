import { google, createGoogleGenerativeAI } from '@ai-sdk/google';

export type GoogleProviderConfig = {
	apiKey?: string;
};

export function createGoogleModel(model: string, config?: GoogleProviderConfig) {
	if (config?.apiKey) {
		const instance = createGoogleGenerativeAI({ apiKey: config.apiKey });
		return instance(model);
	}
	return google(model);
}
