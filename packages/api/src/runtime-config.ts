import type { CreateClientConfig } from './generated/client.gen';

/**
 * Runtime configuration for the Axios client.
 * 
 * This function is called by the generated client to set up the initial configuration.
 * You can override baseURL, add interceptors, configure auth, etc.
 * 
 * Documentation: https://heyapi.dev/openapi-ts/clients/axios
 */
export const createClientConfig: CreateClientConfig = (config = {}) => ({
	...config,
	// Base URL will be set by the user when they import and configure the client
	// We leave it undefined here so it can be configured at runtime
	baseURL: config.baseURL,
});
