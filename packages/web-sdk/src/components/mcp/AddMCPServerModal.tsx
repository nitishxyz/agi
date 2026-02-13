import { memo, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useAddMCPServer } from '../../hooks/useMCP';

interface AddMCPServerModalProps {
	isOpen: boolean;
	onClose: () => void;
}

type ServerMode = 'local' | 'remote';

function parseCommandString(input: string): {
	command: string;
	args: string[];
} {
	const parts = input.trim().split(/\s+/);
	return { command: parts[0] ?? '', args: parts.slice(1) };
}

function parseEnv(envStr: string): Record<string, string> | undefined {
	const trimmed = envStr.trim();
	if (!trimmed) return undefined;
	const env: Record<string, string> = {};
	for (const line of trimmed.split('\n')) {
		const eq = line.indexOf('=');
		if (eq > 0) {
			env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
		}
	}
	return Object.keys(env).length > 0 ? env : undefined;
}

function parseHeaders(headerStr: string): Record<string, string> | undefined {
	const trimmed = headerStr.trim();
	if (!trimmed) return undefined;
	const headers: Record<string, string> = {};
	for (const line of trimmed.split('\n')) {
		const colon = line.indexOf(':');
		if (colon > 0) {
			headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
		}
	}
	return Object.keys(headers).length > 0 ? headers : undefined;
}

export const AddMCPServerModal = memo(function AddMCPServerModal({
	isOpen,
	onClose,
}: AddMCPServerModalProps) {
	const [serverMode, setServerMode] = useState<ServerMode>('local');
	const [name, setName] = useState('');
	const [commandStr, setCommandStr] = useState('');
	const [url, setUrl] = useState('');
	const [transport, setTransport] = useState<'http' | 'sse'>('http');
	const [headersStr, setHeadersStr] = useState('');
	const [envStr, setEnvStr] = useState('');
	const [error, setError] = useState<string | null>(null);

	const addServer = useAddMCPServer();

	const reset = useCallback(() => {
		setName('');
		setCommandStr('');
		setUrl('');
		setTransport('http');
		setHeadersStr('');
		setEnvStr('');
		setError(null);
		setServerMode('local');
	}, []);

	const handleClose = useCallback(() => {
		reset();
		onClose();
	}, [reset, onClose]);

	const handleSubmit = useCallback(async () => {
		setError(null);
		const trimmedName = name.trim();

		if (!trimmedName) {
			setError('Server name is required');
			return;
		}

		try {
			if (serverMode === 'local') {
				const trimmedCmd = commandStr.trim();
				if (!trimmedCmd) {
					setError('Command is required');
					return;
				}
				const { command, args } = parseCommandString(trimmedCmd);
				await addServer.mutateAsync({
					name: trimmedName,
					transport: 'stdio',
					command,
					args,
					env: parseEnv(envStr),
				});
			} else {
				const trimmedUrl = url.trim();
				if (!trimmedUrl) {
					setError('URL is required');
					return;
				}
				await addServer.mutateAsync({
					name: trimmedName,
					transport,
					url: trimmedUrl,
					headers: parseHeaders(headersStr),
				});
			}
			handleClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to add server');
		}
	}, [
		name,
		serverMode,
		commandStr,
		envStr,
		url,
		transport,
		headersStr,
		addServer,
		handleClose,
	]);

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Add MCP Server">
			<div className="space-y-4">
				<div className="flex gap-1 p-1 bg-muted rounded-md">
					<button
						type="button"
						onClick={() => setServerMode('local')}
						className={`flex-1 text-xs py-1.5 px-3 rounded transition-colors ${
							serverMode === 'local'
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground'
						}`}
					>
						Local (stdio)
					</button>
					<button
						type="button"
						onClick={() => setServerMode('remote')}
						className={`flex-1 text-xs py-1.5 px-3 rounded transition-colors ${
							serverMode === 'remote'
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground'
						}`}
					>
						Remote (HTTP)
					</button>
				</div>

				<div>
					<div className="text-sm font-medium mb-1">Name</div>
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="e.g. github, linear, helius"
						autoFocus
					/>
				</div>

				{serverMode === 'local' ? (
					<>
						<div>
							<div className="text-sm font-medium mb-1">Command</div>
							<Input
								value={commandStr}
								onChange={(e) => setCommandStr(e.target.value)}
								placeholder="e.g. npx -y @modelcontextprotocol/server-github"
								onKeyDown={(e) => {
									if (e.key === 'Enter') handleSubmit();
								}}
							/>
							<p className="text-xs text-muted-foreground mt-1">
								Like{' '}
								<code className="bg-muted px-1 rounded">
									npx -y helius-mcp@latest
								</code>
							</p>
						</div>
						<div>
							<div className="text-sm font-medium mb-1">
								Environment Variables
							</div>
							<textarea
								value={envStr}
								onChange={(e) => setEnvStr(e.target.value)}
								placeholder={'GITHUB_TOKEN=ghp_xxx\nAPI_KEY=sk-xxx'}
								rows={2}
								className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary"
							/>
							<p className="text-xs text-muted-foreground mt-1">
								One per line: KEY=VALUE
							</p>
						</div>
					</>
				) : (
					<>
						<div>
							<div className="text-sm font-medium mb-1">URL</div>
							<Input
								value={url}
								onChange={(e) => setUrl(e.target.value)}
								placeholder="e.g. https://mcp.linear.app/mcp"
								onKeyDown={(e) => {
									if (e.key === 'Enter') handleSubmit();
								}}
							/>
						</div>
						<div>
							<div className="text-sm font-medium mb-1">Transport</div>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={() => setTransport('http')}
									className={`text-xs px-3 py-1.5 rounded border transition-colors ${
										transport === 'http'
											? 'border-primary bg-primary/10 text-foreground'
											: 'border-border text-muted-foreground'
									}`}
								>
									HTTP (recommended)
								</button>
								<button
									type="button"
									onClick={() => setTransport('sse')}
									className={`text-xs px-3 py-1.5 rounded border transition-colors ${
										transport === 'sse'
											? 'border-primary bg-primary/10 text-foreground'
											: 'border-border text-muted-foreground'
									}`}
								>
									SSE (legacy)
								</button>
							</div>
						</div>
						<div>
							<div className="text-sm font-medium mb-1">Headers</div>
							<textarea
								value={headersStr}
								onChange={(e) => setHeadersStr(e.target.value)}
								placeholder={'Authorization: Bearer xxx'}
								rows={2}
								className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary"
							/>
							<p className="text-xs text-muted-foreground mt-1">
								One per line: Header-Name: value
							</p>
						</div>
						<p className="text-xs text-muted-foreground">
							For OAuth servers (Linear, Notion, etc.), leave headers empty and
							authenticate after adding.
						</p>
					</>
				)}

				{error && (
					<div className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded">
						{error}
					</div>
				)}

				<div className="flex justify-end gap-2 pt-2">
					<Button variant="ghost" onClick={handleClose}>
						Cancel
					</Button>
					<Button
						variant="primary"
						onClick={handleSubmit}
						disabled={addServer.isPending}
					>
						{addServer.isPending ? (
							<>
								<Loader2 className="w-3 h-3 animate-spin mr-1" />
								Adding...
							</>
						) : (
							'Add Server'
						)}
					</Button>
				</div>
			</div>
		</Modal>
	);
});
