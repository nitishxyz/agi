import type { ProviderId } from './provider';

/**
 * API key authentication
 */
export type ApiAuth = { type: 'api'; key: string };

/**
 * OAuth authentication tokens
 */
export type OAuth = {
	type: 'oauth';
	access: string;
	refresh: string;
	expires: number;
};

/**
 * Union of all auth types
 */
export type AuthInfo = ApiAuth | OAuth;

/**
 * Collection of auth credentials per provider
 */
export type AuthFile = Partial<Record<ProviderId, AuthInfo>>;
