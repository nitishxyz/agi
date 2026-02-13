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

function parseCommandString(input: string): {
	command: string;
	args: string[];
} {
	const parts = input.trim().split(/\s+/);
	return { command: parts[0] ?? '', args: parts.slice(1) };
}

export const AddMCPServerModal = memo(function AddMCPServerModal({
	isOpen,
	onClose,
}: AddMCPServerModalProps) {
	const [mode, setMode] = useState<'quick' | 'advanced'>('quick');
	const [name, setName] = useState('');
	const [commandStr, setCommandStr] = useState('');
	const [command, setCommand] = useState('');
	const [argsStr, setArgsStr] = useState('');
	const [envStr, setEnvStr] = useState('');
	const [error, setError] = useState<string | null>(null);

	const addServer = useAddMCPServer();

	const reset = useCallback(() => {
		setName('');
		setCommandStr('');
		setCommand('');
		setArgsStr('');
		setEnvStr('');
		setError(null);
		setMode('quick');
	}, []);

	const handleClose = useCallback(() => {
		reset();
		onClose();
	}, [reset, onClose]);

	const handleQuickAdd = useCallback(async () => {
		setError(null);
		const trimmedName = name.trim();
		const trimmedCmd = commandStr.trim();

		if (!trimmedName) {
			setError('Server name is required');
			return;
		}
		if (!trimmedCmd) {
			setError('Command is required');
			return;
		}

		const { command: cmd, args } = parseCommandString(trimmedCmd);

		try {
			await addServer.mutateAsync({
				name: trimmedName,
				command: cmd,
				args,
			});
			handleClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to add server');
		}
	}, [name, commandStr, addServer, handleClose]);

	const handleAdvancedAdd = useCallback(async () => {
		setError(null);
		const trimmedName = name.trim();
		const trimmedCmd = command.trim();

		if (!trimmedName) {
			setError('Server name is required');
			return;
		}
		if (!trimmedCmd) {
			setError('Command is required');
			return;
		}

		const args = argsStr
			.trim()
			.split(/\s+/)
			.filter((a) => a.length > 0);

		let env: Record<string, string> | undefined;
		if (envStr.trim()) {
			env = {};
			for (const line of envStr.split('\n')) {
				const eq = line.indexOf('=');
				if (eq > 0) {
					env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
				}
			}
		}

		try {
			await addServer.mutateAsync({
				name: trimmedName,
				command: trimmedCmd,
				args,
				env,
			});
			handleClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to add server');
		}
	}, [name, command, argsStr, envStr, addServer, handleClose]);

	const handleSubmit = mode === 'quick' ? handleQuickAdd : handleAdvancedAdd;

	return (
		<Modal isOpen={isOpen} onClose={handleClose} title="Add MCP Server">
			<div className="space-y-4">
				<div className="flex gap-1 p-1 bg-muted rounded-md">
					<button
						type="button"
						onClick={() => setMode('quick')}
						className={`flex-1 text-xs py-1.5 px-3 rounded transition-colors ${
							mode === 'quick'
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground'
						}`}
					>
						Quick Add
					</button>
					<button
						type="button"
						onClick={() => setMode('advanced')}
						className={`flex-1 text-xs py-1.5 px-3 rounded transition-colors ${
							mode === 'advanced'
								? 'bg-background text-foreground shadow-sm'
								: 'text-muted-foreground hover:text-foreground'
						}`}
					>
						Advanced
					</button>
				</div>

				<div>
					<div className="text-sm font-medium mb-1">Name</div>
					<Input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="e.g. github, helius, filesystem"
						autoFocus
					/>
				</div>

				{mode === 'quick' ? (
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
				) : (
					<>
						<div>
							<div className="text-sm font-medium mb-1">Command</div>
							<Input
								value={command}
								onChange={(e) => setCommand(e.target.value)}
								placeholder="e.g. npx, node, python"
							/>
						</div>
						<div>
							<div className="text-sm font-medium mb-1">Arguments</div>
							<Input
								value={argsStr}
								onChange={(e) => setArgsStr(e.target.value)}
								placeholder="e.g. -y @modelcontextprotocol/server-github"
							/>
						</div>
						<div>
							<div className="text-sm font-medium mb-1">
								Environment Variables
							</div>
							<textarea
								value={envStr}
								onChange={(e) => setEnvStr(e.target.value)}
								placeholder={'GITHUB_TOKEN=ghp_xxx\nAPI_KEY=sk-xxx'}
								rows={3}
								className="w-full bg-muted border border-border rounded-md px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary"
							/>
							<p className="text-xs text-muted-foreground mt-1">
								One per line: KEY=VALUE
							</p>
						</div>
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
