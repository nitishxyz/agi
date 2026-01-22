import { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
	ChevronRight,
	FlaskConical,
	Plus,
	History,
	Loader2,
	ArrowUp,
	ArrowDownToLine,
	ExternalLink,
	ChevronDown,
} from 'lucide-react';
import { useResearchStore } from '../../stores/researchStore';
import {
	useResearchSessions,
	useCreateResearchSession,
	useInjectContext,
	useExportToSession,
	type ResearchSession,
} from '../../hooks/useResearch';
import { useUpdateSession } from '../../hooks/useSessions';
import { useAllModels } from '../../hooks/useConfig';
import { useMessages } from '../../hooks/useMessages';
import { useSessionStream } from '../../hooks/useSessionStream';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { Modal } from '../ui/Modal';
import { UnifiedModelSelector } from '../chat/UnifiedModelSelector';
import { AssistantMessageGroup } from '../messages/AssistantMessageGroup';
import { UserMessageGroup } from '../messages/UserMessageGroup';

interface ResearchSidebarProps {
	parentSessionId: string | null;
	onNavigateToSession?: (sessionId: string) => void;
}

export const ResearchSidebar = memo(function ResearchSidebar({
	parentSessionId,
	onNavigateToSession,
}: ResearchSidebarProps) {
	const isExpanded = useResearchStore((state) => state.isExpanded);
	const collapseSidebar = useResearchStore((state) => state.collapseSidebar);
	const activeResearchSessionId = useResearchStore(
		(state) => state.activeResearchSessionId,
	);
	const selectResearchSession = useResearchStore(
		(state) => state.selectResearchSession,
	);

	const [showHistory, setShowHistory] = useState(false);
	const [inputValue, setInputValue] = useState('');
	const [showModelSelector, setShowModelSelector] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const {
		data: researchData,
		isLoading,
		refetch,
	} = useResearchSessions(parentSessionId);
	const createMutation = useCreateResearchSession();
	const injectMutation = useInjectContext();
	const exportMutation = useExportToSession();
	const { data: allModels } = useAllModels();

	const { data: messagesData } = useMessages(
		activeResearchSessionId ?? undefined,
	);

	// Enable streaming for the active research session
	useSessionStream(activeResearchSessionId ?? undefined);

	const updateSession = useUpdateSession(activeResearchSessionId ?? '');

	const queryClient = useQueryClient();
	const sendMessage = useMutation({
		mutationFn: async ({
			sessionId,
			content,
		}: {
			sessionId: string;
			content: string;
		}) => apiClient.sendMessage(sessionId, { content }),
		onSuccess: (_, { sessionId }) => {
			queryClient.invalidateQueries({ queryKey: ['messages', sessionId] });
		},
	});

	useEffect(() => {
		if (parentSessionId) {
			useResearchStore.getState().setParentSessionId(parentSessionId);
		}
	}, [parentSessionId]);

	useEffect(() => {
		if (researchData?.sessions?.length) {
			const currentIsValid = researchData.sessions.some(
				(s) => s.id === activeResearchSessionId,
			);
			if (!currentIsValid) {
				selectResearchSession(researchData.sessions[0].id);
			}
		} else if (researchData?.sessions?.length === 0) {
			selectResearchSession(null);
		}
	}, [researchData, activeResearchSessionId, selectResearchSession]);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messagesData]);

	const adjustTextareaHeight = useCallback(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		textarea.style.height = 'auto';
		textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
	}, []);

	useEffect(() => {
		adjustTextareaHeight();
	}, [inputValue, adjustTextareaHeight]);

	const handleCreateNew = useCallback(async () => {
		if (!parentSessionId) return;
		try {
			const result = await createMutation.mutateAsync({
				parentSessionId,
				data: {},
			});
			// Wait for query to refetch before selecting
			await refetch();
			selectResearchSession(result.session.id);
			setShowHistory(false);
		} catch (err) {
			console.error('Failed to create research session:', err);
		}
	}, [parentSessionId, createMutation, selectResearchSession, refetch]);

	const handleSelectSession = useCallback(
		(session: ResearchSession) => {
			selectResearchSession(session.id);
			setShowHistory(false);
		},
		[selectResearchSession],
	);

	const handleInject = useCallback(async () => {
		if (!parentSessionId || !activeResearchSessionId) return;
		try {
			await injectMutation.mutateAsync({
				parentSessionId,
				researchSessionId: activeResearchSessionId,
				label: 'Research findings',
			});
		} catch (err) {
			console.error('Failed to inject context:', err);
		}
	}, [parentSessionId, activeResearchSessionId, injectMutation]);

	const handleExport = useCallback(async () => {
		if (!activeResearchSessionId) return;
		try {
			const result = await exportMutation.mutateAsync({
				researchId: activeResearchSessionId,
			});
			if (onNavigateToSession && result.newSession?.id) {
				onNavigateToSession(result.newSession.id);
			}
		} catch (err) {
			console.error('Failed to export to session:', err);
		}
	}, [activeResearchSessionId, exportMutation, onNavigateToSession]);

	const handleSendMessage = useCallback(async () => {
		if (!inputValue.trim() || !parentSessionId) return;
		try {
			let sessionId = activeResearchSessionId;

			if (!sessionId) {
				const result = await createMutation.mutateAsync({
					parentSessionId,
					data: {},
				});
				sessionId = result.session.id;
				selectResearchSession(sessionId);
			}

			await sendMessage.mutateAsync({
				sessionId,
				content: inputValue,
			});
			setInputValue('');
			if (textareaRef.current) {
				textareaRef.current.style.height = 'auto';
			}
		} catch (err) {
			console.error('Failed to send message:', err);
		}
	}, [
		inputValue,
		parentSessionId,
		activeResearchSessionId,
		createMutation,
		selectResearchSession,
		sendMessage,
	]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				handleSendMessage();
			}
		},
		[handleSendMessage],
	);

	const isGenerating = useMemo(
		() =>
			messagesData?.some(
				(m) => m.role === 'assistant' && m.status === 'pending',
			) ?? false,
		[messagesData],
	);

	const handleModelChange = useCallback(
		async (newProvider: string, newModel: string) => {
			if (!activeResearchSessionId) return;
			try {
				await updateSession.mutateAsync({
					provider: newProvider,
					model: newModel,
				});
				setShowModelSelector(false);
			} catch (err) {
				console.error('Failed to update research session model:', err);
			}
		},
		[activeResearchSessionId, updateSession],
	);

	if (!isExpanded) return null;

	const sessions = researchData?.sessions ?? [];
	const activeSession = sessions.find((s) => s.id === activeResearchSessionId);
	const messages = messagesData ?? [];

	const currentProviderLabel =
		allModels?.[activeSession?.provider ?? '']?.label ?? activeSession?.provider;
	const currentModelLabel =
		allModels?.[activeSession?.provider ?? '']?.models.find(
			(m) => m.id === activeSession?.model,
		)?.label ?? activeSession?.model;

	return (
		<div className="w-96 border-l border-border bg-background flex flex-col h-full">
			{/* Header */}
			<div className="h-14 border-b border-border px-3 flex items-center justify-between">
				<div className="flex items-center gap-2 flex-1">
					<FlaskConical className="w-4 h-4 text-teal-500" />
					<span className="font-medium text-foreground text-sm">Research</span>
				</div>
				<div className="flex items-center gap-0.5">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setShowHistory(!showHistory)}
						title="Research history"
						className="h-8 w-8"
					>
						<History className="w-4 h-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={handleCreateNew}
						disabled={!parentSessionId || createMutation.isPending}
						title="New research session"
						className="h-8 w-8"
					>
						{createMutation.isPending ? (
							<Loader2 className="w-4 h-4 animate-spin" />
						) : (
							<Plus className="w-4 h-4" />
						)}
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={collapseSidebar}
						title="Close sidebar"
						className="h-8 w-8"
					>
						<ChevronRight className="w-4 h-4" />
					</Button>
				</div>
			</div>

			{showHistory ? (
				<div className="flex-1 overflow-y-auto">
					<div className="p-2 border-b border-border">
						<div className="text-xs font-medium text-muted-foreground px-2 py-1">
							Research Sessions
						</div>
					</div>
					{isLoading ? (
						<div className="p-4 text-sm text-muted-foreground">Loading...</div>
					) : sessions.length === 0 ? (
						<div className="p-4 text-sm text-muted-foreground">
							No research sessions yet
						</div>
					) : (
						<div className="p-2 space-y-1">
							{sessions.map((session) => (
								<button
									type="button"
									key={session.id}
									onClick={() => handleSelectSession(session)}
									className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
										session.id === activeResearchSessionId
											? 'bg-teal-500/10 border border-teal-500/30 text-foreground'
											: 'hover:bg-muted'
									}`}
								>
									<div className="font-medium truncate">
										{session.title || 'Untitled'}
									</div>
									<div className="text-xs text-muted-foreground">
										{session.messageCount} messages •{' '}
										{formatRelativeTime(
											session.lastActiveAt ?? session.createdAt,
										)}
									</div>
								</button>
							))}
						</div>
					)}
				</div>
			) : (
				<>
					{/* Messages area - using the same components as main chat, but smaller */}
					<div className="flex-1 overflow-y-auto px-3 py-3 research-messages text-[13px]">
						{!activeResearchSessionId ? (
							<div className="text-xs text-muted-foreground text-center py-8">
								<FlaskConical className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
								<p>Start researching by asking a question below.</p>
							</div>
						) : messages.length === 0 ? (
							<div className="text-xs text-muted-foreground text-center py-8">
								<p>Ask a question to start researching.</p>
							</div>
						) : (
							<div className="space-y-1.5">
								{messages.map((msg, index) => {
									if (msg.role === 'user') {
										const nextMsg = messages[index + 1];
										return (
											<UserMessageGroup
												key={msg.id}
												sessionId={activeResearchSessionId}
												message={msg}
												isFirst={index === 0}
												nextAssistantMessageId={
													nextMsg?.role === 'assistant' ? nextMsg.id : undefined
												}
											/>
										);
									}
									if (msg.role === 'assistant') {
										const prevMsg = index > 0 ? messages[index - 1] : null;
										const nextMsg = messages[index + 1];
										const showHeader = prevMsg?.role !== 'assistant';
										const hasNextAssistant = nextMsg?.role === 'assistant';
										return (
											<AssistantMessageGroup
												key={msg.id}
												sessionId={activeResearchSessionId}
												message={msg}
												showHeader={showHeader}
												hasNextAssistantMessage={hasNextAssistant}
												isLastMessage={index === messages.length - 1}
												compact
												onNavigateToSession={onNavigateToSession}
											/>
										);
									}
									return null;
								})}
								<div ref={messagesEndRef} />
							</div>
						)}
					</div>

					{/* Input area */}
					<div className="p-3 border-t border-border">
						<div className="relative flex flex-col rounded-3xl bg-card border border-border focus-within:border-teal-500/60 focus-within:ring-1 focus-within:ring-teal-500/40 p-1">
							<div className="flex items-end gap-1">
								<Textarea
									ref={textareaRef}
									value={inputValue}
									onChange={(e) => setInputValue(e.target.value)}
									onKeyDown={handleKeyDown}
									placeholder="Ask anything..."
									disabled={
										!parentSessionId ||
										sendMessage.isPending ||
										createMutation.isPending
									}
									rows={1}
									className="flex-1 border-0 bg-transparent pl-2 pr-1 py-2 max-h-[120px] overflow-y-auto leading-normal resize-none scrollbar-hide text-sm focus:ring-0 focus:outline-none"
									style={{ height: '2.25rem' }}
								/>
								<button
									type="button"
									onClick={handleSendMessage}
									disabled={
										!inputValue.trim() ||
										!parentSessionId ||
										sendMessage.isPending ||
										createMutation.isPending ||
										isGenerating
									}
									className={`flex items-center justify-center w-9 h-9 rounded-full transition-colors flex-shrink-0 ${
										inputValue.trim() && parentSessionId && !isGenerating
											? 'bg-teal-500 hover:bg-teal-600 text-white'
											: 'bg-transparent text-muted-foreground'
									}`}
								>
									{sendMessage.isPending || createMutation.isPending ? (
										<Loader2 className="w-4 h-4 animate-spin" />
									) : (
										<ArrowUp className="w-4 h-4" />
									)}
						</button>
					</div>
				</div>

				{/* Action buttons */}
				<div className="flex gap-2 mt-2">
							<button
								type="button"
								onClick={handleInject}
								disabled={
									!activeResearchSessionId ||
									injectMutation.isPending ||
									isGenerating
								}
								className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								title="Inject findings into main session"
							>
								{injectMutation.isPending ? (
									<Loader2 className="w-3 h-3 animate-spin" />
								) : (
									<ArrowDownToLine className="w-3 h-3" />
								)}
								Inject
							</button>
							<button
								type="button"
								onClick={handleExport}
								disabled={
									!activeResearchSessionId ||
									exportMutation.isPending ||
									isGenerating
								}
								className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								title="Export to new main session"
							>
								{exportMutation.isPending ? (
									<Loader2 className="w-3 h-3 animate-spin" />
								) : (
									<ExternalLink className="w-3 h-3" />
								)}
								Export
							</button>
						</div>
					</div>
				</>
			)}

			{/* Footer */}
			<div className="h-12 px-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
				<span className="text-[10px]">
					{sessions.length} research session{sessions.length !== 1 ? 's' : ''}
				</span>
				{activeSession && (
					<button
						type="button"
						onClick={() => setShowModelSelector(true)}
						className="flex items-center gap-1 text-[10px] hover:text-foreground transition-colors"
					>
						<span className="opacity-60">{currentProviderLabel}</span>
						<span className="opacity-40">/</span>
						<span>{currentModelLabel}</span>
						<ChevronDown className="w-3 h-3 opacity-40" />
					</button>
				)}
			</div>

			{/* Model Selector Modal */}
			<Modal
				isOpen={showModelSelector}
				onClose={() => setShowModelSelector(false)}
				title="Select Model for Research"
				maxWidth="md"
			>
				{activeSession && (
					<UnifiedModelSelector
						provider={activeSession.provider}
						model={activeSession.model}
						onChange={handleModelChange}
					/>
				)}
			</Modal>
		</div>
	);
});

function formatRelativeTime(timestamp: number): string {
	const diff = Date.now() - timestamp;
	const minutes = Math.floor(diff / 60000);
	if (minutes < 1) return 'just now';
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}
