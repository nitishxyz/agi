import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback, useRef } from 'react';
import { useTunnelStore } from '../stores/tunnelStore';
import { API_BASE_URL } from '../lib/config';

interface TunnelStatusResponse {
	status: 'idle' | 'starting' | 'connected' | 'error';
	url: string | null;
	error: string | null;
	binaryInstalled: boolean;
	isRunning: boolean;
}

interface TunnelStartResponse {
	ok: boolean;
	url?: string;
	message?: string;
	error?: string;
}

interface TunnelQrResponse {
	ok: boolean;
	url?: string;
	qrCode?: string;
	error?: string;
}

async function fetchTunnelStatus(): Promise<TunnelStatusResponse> {
	const response = await fetch(`${API_BASE_URL}/v1/tunnel/status`);
	if (!response.ok) {
		throw new Error('Failed to fetch tunnel status');
	}
	return response.json();
}

async function startTunnel(): Promise<TunnelStartResponse> {
	// Server uses its own port automatically - no need to pass it
	const response = await fetch(`${API_BASE_URL}/v1/tunnel/start`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({}),
	});
	return response.json();
}

async function stopTunnel(): Promise<{ ok: boolean; message?: string; error?: string }> {
	const response = await fetch(`${API_BASE_URL}/v1/tunnel/stop`, {
		method: 'POST',
	});
	return response.json();
}

async function fetchTunnelQr(): Promise<TunnelQrResponse> {
	const response = await fetch(`${API_BASE_URL}/v1/tunnel/qr`);
	return response.json();
}

export function useTunnelStatus() {
	const setStatus = useTunnelStore((s) => s.setStatus);
	const setUrl = useTunnelStore((s) => s.setUrl);
	const setError = useTunnelStore((s) => s.setError);

	const query = useQuery<TunnelStatusResponse>({
		queryKey: ['tunnel', 'status'],
		queryFn: fetchTunnelStatus,
		refetchInterval: 3000,
	});

	useEffect(() => {
		if (query.data) {
			setStatus(query.data.status);
			setUrl(query.data.url);
			setError(query.data.error);
		}
	}, [query.data, setStatus, setUrl, setError]);

	return query;
}

export function useStartTunnel() {
	const queryClient = useQueryClient();
	const setStatus = useTunnelStore((s) => s.setStatus);
	const setUrl = useTunnelStore((s) => s.setUrl);
	const setError = useTunnelStore((s) => s.setError);
	const setProgress = useTunnelStore((s) => s.setProgress);

	return useMutation<TunnelStartResponse, Error, void>({
		mutationFn: () => startTunnel(),
		onMutate: () => {
			setStatus('starting');
			setProgress('Connecting...');
			setError(null);
		},
		onSuccess: (data) => {
			if (data.ok && data.url) {
				setStatus('connected');
				setUrl(data.url);
				setProgress(null);
			} else if (!data.ok) {
				setStatus('error');
				setError(data.error || 'Failed to start tunnel');
				setProgress(null);
			}
			queryClient.invalidateQueries({ queryKey: ['tunnel'] });
		},
		onError: (error) => {
			setStatus('error');
			setError(error.message);
			setProgress(null);
		},
	});
}

export function useStopTunnel() {
	const queryClient = useQueryClient();
	const reset = useTunnelStore((s) => s.reset);

	return useMutation({
		mutationFn: stopTunnel,
		onSuccess: () => {
			reset();
			queryClient.invalidateQueries({ queryKey: ['tunnel'] });
		},
	});
}

export function useTunnelQr() {
	const url = useTunnelStore((s) => s.url);
	const setQrCode = useTunnelStore((s) => s.setQrCode);

	const query = useQuery<TunnelQrResponse>({
		queryKey: ['tunnel', 'qr', url],
		queryFn: fetchTunnelQr,
		enabled: !!url,
	});

	useEffect(() => {
		if (query.data?.ok && query.data.qrCode) {
			setQrCode(query.data.qrCode);
		}
	}, [query.data, setQrCode]);

	return query;
}

export function useTunnelStream() {
	const setStatus = useTunnelStore((s) => s.setStatus);
	const setUrl = useTunnelStore((s) => s.setUrl);
	const setError = useTunnelStore((s) => s.setError);
	const setProgress = useTunnelStore((s) => s.setProgress);
	const isExpanded = useTunnelStore((s) => s.isExpanded);
	const eventSourceRef = useRef<EventSource | null>(null);

	const connect = useCallback(() => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
		}

		const es = new EventSource(`${API_BASE_URL}/v1/tunnel/stream`);
		eventSourceRef.current = es;

		es.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.type === 'status') {
					setStatus(data.status);
					setUrl(data.url);
					setError(data.error);
					setProgress(data.progress);
				}
			} catch {
				// ignore parse errors
			}
		};

		es.onerror = () => {
			es.close();
			eventSourceRef.current = null;
		};

		return () => {
			es.close();
			eventSourceRef.current = null;
		};
	}, [setStatus, setUrl, setError, setProgress]);

	useEffect(() => {
		if (isExpanded) {
			const cleanup = connect();
			return cleanup;
		}
		return () => {
			if (eventSourceRef.current) {
				eventSourceRef.current.close();
				eventSourceRef.current = null;
			}
		};
	}, [isExpanded, connect]);

	return { connect };
}
