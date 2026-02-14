import { memo, useState, useCallback } from 'react';
import {
	Plug,
	ChevronDown,
	ChevronRight,
	FolderDot,
	Globe,
	Laptop,
	Loader2,
	Lock,
	Play,
	Plus,
	Square,
	Trash2,
	Wrench,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useMCPStore, type MCPServerInfo } from '../../stores/mcpStore';
import {
	useMCPServers,
	useStartMCPServer,
	useStopMCPServer,
	useRemoveMCPServer,
	useAuthenticateMCPServer,
} from '../../hooks/useMCP';
import { openUrl } from '../../lib/open-url';
import { AddMCPServerModal } from './AddMCPServerModal';

const MCPServerCard = memo(function MCPServerCard({
	server,
	isLoading,
	onStart,
	onStop,
	onRemove,
	onAuth,
}: {
	server: MCPServerInfo;
	isLoading: boolean;
	onStart: () => void;
	onStop: () => void;
	onRemove: () => void;
	onAuth: () => void;
}) {
	const [isCollapsed, setIsCollapsed] = useState(true);
	const hasTools = server.connected && server.tools.length > 0;
	const isRemote = server.transport === 'http' || server.transport === 'sse';

	const toggleCollapse = useCallback(() => {
		if (hasTools) setIsCollapsed((prev) => !prev);
	}, [hasTools]);

	return (
		<div className="rounded-lg border border-border p-3 space-y-2 group">
			<div className="flex items-center justify-between">
				<button
					type="button"
					onClick={toggleCollapse}
					className={`flex items-center gap-2 min-w-0 flex-1 text-left ${hasTools ? 'cursor-pointer' : 'cursor-default'}`}
				>
					<span
						className={`w-2 h-2 rounded-full flex-shrink-0 ${
							server.connected
								? 'bg-green-500'
								: server.authRequired
									? 'bg-yellow-500'
									: 'bg-muted-foreground/30'
						}`}
					/>
					<span className="text-sm font-medium truncate">{server.name}</span>
					{isRemote && (
						<Globe className="w-3 h-3 text-muted-foreground flex-shrink-0" />
					)}
					{server.authRequired && !server.connected && (
						<Lock className="w-3 h-3 text-yellow-500 flex-shrink-0" />
					)}
					{hasTools && (
						<span className="flex items-center gap-0.5 text-xs text-muted-foreground flex-shrink-0">
							<Wrench className="w-3 h-3" />
							{server.tools.length}
							{isCollapsed ? (
								<ChevronRight className="w-3 h-3" />
							) : (
								<ChevronDown className="w-3 h-3" />
							)}
						</span>
					)}
				</button>
				<div className="flex items-center gap-0.5">
					<Button
						variant="ghost"
						size="icon"
						onClick={onRemove}
						title="Remove server"
						className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
					>
						<Trash2 className="w-3 h-3 text-muted-foreground hover:text-red-400" />
					</Button>
					{isLoading ? (
						<Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />
					) : server.authRequired && !server.connected ? (
						<Button
							variant="ghost"
							size="icon"
							onClick={onAuth}
							title="Authenticate"
							className="h-7 w-7 flex-shrink-0"
						>
							<Lock className="w-3 h-3 text-yellow-500" />
						</Button>
					) : server.connected ? (
						<Button
							variant="ghost"
							size="icon"
							onClick={onStop}
							title="Stop server"
							className="h-7 w-7 flex-shrink-0"
						>
							<Square className="w-3 h-3 text-red-400" />
						</Button>
					) : (
						<Button
							variant="ghost"
							size="icon"
							onClick={onStart}
							title="Start server"
							className="h-7 w-7 flex-shrink-0"
						>
							<Play className="w-3 h-3 text-green-400" />
						</Button>
					)}
				</div>
			</div>

			<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
				<span className="truncate">
					{isRemote
						? server.url
						: `${server.command ?? ''} ${server.args.join(' ')}`}
				</span>
				<span
					className="flex items-center gap-0.5 flex-shrink-0 opacity-60"
					title={server.scope === 'project' ? 'Project-local' : 'Global'}
				>
					{server.scope === 'project' ? (
						<FolderDot className="w-3 h-3" />
					) : (
						<Laptop className="w-3 h-3" />
					)}
				</span>
			</div>

			{hasTools && !isCollapsed && (
				<div className="flex flex-wrap gap-1 pt-1">
					{server.tools.map((tool) => (
						<span
							key={tool}
							className="text-xs bg-muted px-1.5 py-0.5 rounded"
							title={tool}
						>
							{tool.split('__').pop()}
						</span>
					))}
				</div>
			)}
		</div>
	);
});

export const MCPSidebar = memo(function MCPSidebar() {
	const isExpanded = useMCPStore((s) => s.isExpanded);
	const collapseSidebar = useMCPStore((s) => s.collapseSidebar);
	const servers = useMCPStore((s) => s.servers);
	const loading = useMCPStore((s) => s.loading);

	const { isLoading: isFetching } = useMCPServers();
	const startServer = useStartMCPServer();
	const stopServer = useStopMCPServer();
	const removeServer = useRemoveMCPServer();
	const authServer = useAuthenticateMCPServer();

	const [isAddModalOpen, setIsAddModalOpen] = useState(false);

	const handleAuth = useCallback(
		async (name: string) => {
			try {
				const result = await authServer.mutateAsync(name);
				if (result.authUrl) {
					openUrl(result.authUrl);
				}
			} catch {}
		},
		[authServer],
	);

	const handleStart = useCallback(
		async (name: string) => {
			try {
				const result = await startServer.mutateAsync(name);
				if (result.authRequired && result.authUrl) {
					openUrl(result.authUrl);
				}
			} catch {}
		},
		[startServer],
	);

	if (!isExpanded) return null;

	const connectedCount = servers.filter((s) => s.connected).length;

	return (
		<div className="w-80 border-l border-border bg-background flex flex-col h-full">
			<div className="h-14 flex items-center justify-between px-3 border-b border-border">
				<div className="flex items-center gap-2">
					<Plug className="w-4 h-4 text-muted-foreground" />
					<span className="font-medium text-sm">MCP Servers</span>
					{connectedCount > 0 && (
						<span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">
							{connectedCount} active
						</span>
					)}
				</div>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setIsAddModalOpen(true)}
						title="Add MCP server"
						className="h-7 w-7"
					>
						<Plus className="w-4 h-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={collapseSidebar}
						title="Close sidebar"
					>
						<ChevronRight className="w-4 h-4" />
					</Button>
				</div>
			</div>

			<div className="flex-1 overflow-y-auto">
				{isFetching && servers.length === 0 ? (
					<div className="flex items-center justify-center h-32 text-muted-foreground">
						<Loader2 className="w-4 h-4 animate-spin mr-2" />
						Loading...
					</div>
				) : servers.length === 0 ? (
					<div className="p-4 text-sm text-muted-foreground space-y-3">
						<p>No MCP servers configured.</p>
						<Button
							variant="primary"
							size="sm"
							onClick={() => setIsAddModalOpen(true)}
							className="w-full"
						>
							<Plus className="w-3 h-3 mr-1" />
							Add MCP Server
						</Button>
						<p className="text-xs">
							Or add servers to{' '}
							<code className="bg-muted px-1 py-0.5 rounded text-xs">
								.otto/config.json
							</code>
						</p>
					</div>
				) : (
					<div className="p-2 space-y-1">
						{servers.map((server) => (
							<MCPServerCard
								key={server.name}
								server={server}
								isLoading={loading.has(server.name)}
								onStart={() => handleStart(server.name)}
								onStop={() => stopServer.mutate(server.name)}
								onRemove={() => removeServer.mutate(server.name)}
								onAuth={() => handleAuth(server.name)}
							/>
						))}
					</div>
				)}
			</div>

			<AddMCPServerModal
				isOpen={isAddModalOpen}
				onClose={() => setIsAddModalOpen(false)}
			/>
		</div>
	);
});
