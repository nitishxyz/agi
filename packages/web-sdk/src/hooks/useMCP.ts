import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMCPStore, type MCPServerInfo } from '../stores/mcpStore';
import { API_BASE_URL } from '../lib/config';
import { useEffect } from 'react';

interface MCPServersResponse {
	servers: MCPServerInfo[];
}

async function fetchMCPServers(): Promise<MCPServersResponse> {
	const response = await fetch(`${API_BASE_URL}/v1/mcp/servers`);
	if (!response.ok) throw new Error('Failed to fetch MCP servers');
	return response.json();
}

export function useMCPServers() {
	const setServers = useMCPStore((s) => s.setServers);

	const query = useQuery({
		queryKey: ['mcp', 'servers'],
		queryFn: fetchMCPServers,
		refetchInterval: 10000,
	});

	useEffect(() => {
		if (query.data?.servers) {
			setServers(query.data.servers);
		}
	}, [query.data, setServers]);

	return query;
}

export function useStartMCPServer() {
	const queryClient = useQueryClient();
	const setLoading = useMCPStore((s) => s.setLoading);

	return useMutation({
		mutationFn: async (name: string) => {
			setLoading(name, true);
			const response = await fetch(
				`${API_BASE_URL}/v1/mcp/servers/${encodeURIComponent(name)}/start`,
				{ method: 'POST' },
			);
			const data = await response.json();
			if (!data.ok) throw new Error(data.error || 'Failed to start server');
			return data;
		},
		onSettled: (_data, _error, name) => {
			setLoading(name, false);
			queryClient.invalidateQueries({ queryKey: ['mcp', 'servers'] });
		},
	});
}

export function useStopMCPServer() {
	const queryClient = useQueryClient();
	const setLoading = useMCPStore((s) => s.setLoading);

	return useMutation({
		mutationFn: async (name: string) => {
			setLoading(name, true);
			const response = await fetch(
				`${API_BASE_URL}/v1/mcp/servers/${encodeURIComponent(name)}/stop`,
				{ method: 'POST' },
			);
			const data = await response.json();
			if (!data.ok) throw new Error(data.error || 'Failed to stop server');
			return data;
		},
		onSettled: (_data, _error, name) => {
			setLoading(name, false);
			queryClient.invalidateQueries({ queryKey: ['mcp', 'servers'] });
		},
	});
}

export interface AddMCPServerParams {
	name: string;
	transport?: string;
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	url?: string;
	headers?: Record<string, string>;
	oauth?: {
		clientId?: string;
		callbackPort?: number;
		scopes?: string[];
	};
	scope?: 'global' | 'project';
}

export function useAddMCPServer() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (params: AddMCPServerParams) => {
			const response = await fetch(`${API_BASE_URL}/v1/mcp/servers`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(params),
			});
			const data = await response.json();
			if (!data.ok) throw new Error(data.error || 'Failed to add MCP server');
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['mcp', 'servers'] });
		},
	});
}

export function useRemoveMCPServer() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (name: string) => {
			const response = await fetch(
				`${API_BASE_URL}/v1/mcp/servers/${encodeURIComponent(name)}`,
				{ method: 'DELETE' },
			);
			const data = await response.json();
			if (!data.ok)
				throw new Error(data.error || 'Failed to remove MCP server');
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['mcp', 'servers'] });
		},
	});
}

export function useAuthenticateMCPServer() {
	const queryClient = useQueryClient();
	const setLoading = useMCPStore((s) => s.setLoading);

	return useMutation({
		mutationFn: async (name: string) => {
			setLoading(name, true);
			const response = await fetch(
				`${API_BASE_URL}/v1/mcp/servers/${encodeURIComponent(name)}/auth`,
				{ method: 'POST' },
			);
			const data = await response.json();
			if (!data.ok) throw new Error(data.error || 'Failed to initiate auth');
			return data as { ok: boolean; authUrl?: string; name: string };
		},
		onSettled: (_data, _error, name) => {
			setLoading(name, false);
			queryClient.invalidateQueries({ queryKey: ['mcp', 'servers'] });
		},
	});
}

export function useRevokeMCPAuth() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (name: string) => {
			const response = await fetch(
				`${API_BASE_URL}/v1/mcp/servers/${encodeURIComponent(name)}/auth`,
				{ method: 'DELETE' },
			);
			const data = await response.json();
			if (!data.ok) throw new Error(data.error || 'Failed to revoke auth');
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['mcp', 'servers'] });
		},
	});
}

export function useMCPAuthStatus(name: string | null) {
	return useQuery({
		queryKey: ['mcp', 'auth', name],
		queryFn: async () => {
			if (!name) return { authenticated: false };
			const response = await fetch(
				`${API_BASE_URL}/v1/mcp/servers/${encodeURIComponent(name)}/auth/status`,
			);
			return response.json() as Promise<{
				authenticated: boolean;
				expiresAt?: number;
			}>;
		},
		enabled: !!name,
		refetchInterval: 3000,
	});
}
