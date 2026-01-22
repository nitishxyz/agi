import {
	memo,
	useState,
	useCallback,
	useEffect,
	useRef,
	forwardRef,
	useImperativeHandle,
	useMemo,
} from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSendMessage, useMessages } from '../../hooks/useMessages';
import { useSession, useUpdateSession } from '../../hooks/useSessions';
import { useAllModels } from '../../hooks/useConfig';
import { usePreferences } from '../../hooks/usePreferences';
import { useGitStatus, useStageFiles } from '../../hooks/useGit';
import { useGitStore } from '../../stores/gitStore';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useQueueStore } from '../../stores/queueStore';
import { ChatInput } from './ChatInput';
import { ConfigModal } from './ConfigModal';
import { API_BASE_URL } from '../../lib/config';

interface ChatInputContainerProps {
	sessionId: string;
	userContext?: string;
	onNewSession?: () => void;
}

export interface ChatInputContainerRef {
	focus: () => void;
}

export const ChatInputContainer = memo(
	forwardRef<ChatInputContainerRef, ChatInputContainerProps>(
		function ChatInputContainer({ sessionId, userContext, onNewSession }, ref) {
			const session = useSession(sessionId);
			const [agent, setAgent] = useState('');
			const [provider, setProvider] = useState('');
			const [model, setModel] = useState('');
			const [isConfigOpen, setIsConfigOpen] = useState(false);
			const [configFocusTarget, setConfigFocusTarget] = useState<
				'agent' | 'model' | null
			>(null);
			const [inputKey, setInputKey] = useState(0);

			const chatInputRef = useRef<{
				focus: () => void;
				setValue: (value: string) => void;
			}>(null);

			const sendMessage = useSendMessage(sessionId);
			const { data: messages } = useMessages(sessionId);
			const updateSession = useUpdateSession(sessionId);
			const { data: allModels } = useAllModels();
			const { preferences } = usePreferences();
			const { data: gitStatus } = useGitStatus();
			const stageFiles = useStageFiles();
			const openCommitModal = useGitStore((state) => state.openCommitModal);

			const {
				images,
				documents,
				isDragging,
				removeFile,
				clearFiles,
				handlePaste,
			} = useFileUpload();

			const modelSupportsReasoning = allModels?.[provider]?.models?.find(
				(m) => m.id === model,
			)?.reasoning;

			const modelSupportsVision = allModels?.[provider]?.models?.find(
				(m) => m.id === model,
			)?.vision;

			const queryClient = useQueryClient();

			const researchContexts = useMemo(() => {
				if (!messages) return [];
				return messages
					.filter(
						(m) =>
							m.role === 'system' &&
							m.parts?.some(
								(p) =>
									typeof p.content === 'string' &&
									p.content.includes('<research-context'),
							),
					)
					.map((m) => {
						const part = m.parts?.find(
							(p) =>
								typeof p.content === 'string' &&
								p.content.includes('<research-context'),
						);
						const content =
							typeof part?.content === 'string' ? part.content : '';
						const labelMatch = content.match(/label="([^"]+)"/);
						return {
							id: m.id,
							label: labelMatch?.[1] || 'Research context',
						};
					});
			}, [messages]);

			const deleteResearchContext = useMutation({
				mutationFn: async (messageId: string) => {
					const response = await fetch(
						`${API_BASE_URL}/v1/sessions/${sessionId}/queue/${messageId}`,
						{ method: 'DELETE' },
					);
					if (!response.ok) {
						throw new Error('Failed to delete research context');
					}
					return response.json();
				},
				onSuccess: () => {
					queryClient.invalidateQueries({ queryKey: ['messages', sessionId] });
				},
			});

			const handleResearchContextRemove = useCallback(
				(messageId: string) => {
					deleteResearchContext.mutate(messageId);
				},
				[deleteResearchContext],
			);

			const providerAuthType = allModels?.[provider]?.authType;

			useEffect(() => {
				if (session) {
					setAgent(session.agent);
					setProvider(session.provider);
					setModel(session.model);
				}
			}, [session]);

			useEffect(() => {
				setInputKey((prev) => prev + 1);
			}, []);

			const pendingRestoreText = useQueueStore(
				(state) => state.pendingRestoreText,
			);
			const consumeRestoreText = useQueueStore(
				(state) => state.consumeRestoreText,
			);

			useEffect(() => {
				if (pendingRestoreText) {
					const text = consumeRestoreText();
					if (text) {
						chatInputRef.current?.setValue(text);
					}
				}
			}, [pendingRestoreText, consumeRestoreText]);

			useImperativeHandle(ref, () => ({
				focus: () => {
					chatInputRef.current?.focus();
				},
			}));

			const handleSendMessage = useCallback(
				async (content: string) => {
					try {
						const imageData =
							images.length > 0
								? images.map((img) => ({
										data: img.data,
										mediaType: img.mediaType,
									}))
								: undefined;

						const fileData =
							documents.length > 0
								? documents.map((f) => ({
										type: f.type,
										name: f.name,
										data: f.data,
										mediaType: f.mediaType,
										textContent: f.textContent,
									}))
								: undefined;

						await sendMessage.mutateAsync({
							content,
							images: imageData,
							files: fileData,
							agent: agent || undefined,
							provider: provider || undefined,
							model: model || undefined,
							userContext: userContext || undefined,
							reasoning:
								modelSupportsReasoning && preferences.reasoningEnabled
									? true
									: undefined,
						});

						clearFiles();
					} catch (error) {
						console.error('Failed to send message:', error);
					}
				},
				[
					sendMessage,
					documents,
					images,
					clearFiles,
					agent,
					provider,
					model,
					userContext,
					modelSupportsReasoning,
					preferences.reasoningEnabled,
				],
			);

			const handleToggleConfig = useCallback(() => {
				setIsConfigOpen((prev) => !prev);
			}, []);

			const handleCloseConfig = useCallback(() => {
				setIsConfigOpen(false);
				setConfigFocusTarget(null);
			}, []);

			const handleCommand = useCallback(
				(commandId: string) => {
					if (commandId === 'models') {
						setConfigFocusTarget('model');
						setIsConfigOpen(true);
					} else if (commandId === 'agents') {
						setConfigFocusTarget('agent');
						setIsConfigOpen(true);
					} else if (commandId === 'new') {
						onNewSession?.();
					} else if (commandId === 'stage') {
						const unstagedPaths = gitStatus?.unstaged?.map((f) => f.path) ?? [];
						const untrackedPaths =
							gitStatus?.untracked?.map((f) => f.path) ?? [];
						const allUnstaged = [...unstagedPaths, ...untrackedPaths];
						if (allUnstaged.length > 0) {
							stageFiles.mutate(allUnstaged);
						}
					} else if (commandId === 'commit') {
						openCommitModal();
					} else if (commandId === 'compact') {
						handleSendMessage('/compact');
					}
				},
				[
					onNewSession,
					gitStatus,
					stageFiles,
					openCommitModal,
					handleSendMessage,
				],
			);

			const handleAgentChange = useCallback(
				async (value: string) => {
					setAgent(value);
					try {
						await updateSession.mutateAsync({ agent: value });
					} catch (error) {
						console.error('Failed to update agent:', error);
					}
				},
				[updateSession],
			);

			const handleModelSelectorChange = useCallback(
				async (newProvider: string, newModel: string) => {
					setProvider(newProvider);
					setModel(newModel);
					try {
						await updateSession.mutateAsync({
							provider: newProvider,
							model: newModel,
						});
					} catch (error) {
						console.error('Failed to update model:', error);
					}
				},
				[updateSession],
			);

			const handleProviderChange = useCallback(
				async (newProvider: string) => {
					setProvider(newProvider);
					if (model) {
						try {
							await updateSession.mutateAsync({
								provider: newProvider,
								model,
							});
						} catch (error) {
							console.error('Failed to update provider:', error);
						}
					}
				},
				[model, updateSession],
			);

			const handleModelChange = useCallback(
				async (newModel: string) => {
					setModel(newModel);
					try {
						await updateSession.mutateAsync({ provider, model: newModel });
					} catch (error) {
						console.error('Failed to update model:', error);
					}
				},
				[provider, updateSession],
			);

			const handlePlanModeToggle = useCallback(
				async (isPlanMode: boolean) => {
					const newAgent = isPlanMode ? 'plan' : 'build';
					setAgent(newAgent);
					try {
						await updateSession.mutateAsync({ agent: newAgent });
					} catch (error) {
						console.error('Failed to switch agent:', error);
					}
				},
				[updateSession],
			);

			return (
				<>
					<ConfigModal
						isOpen={isConfigOpen}
						onClose={handleCloseConfig}
						initialFocus={configFocusTarget}
						chatInputRef={chatInputRef}
						agent={agent}
						provider={provider}
						model={model}
						modelSupportsReasoning={modelSupportsReasoning}
						onAgentChange={handleAgentChange}
						onProviderChange={handleProviderChange}
						onModelChange={handleModelChange}
						onModelSelectorChange={handleModelSelectorChange}
					/>
					<ChatInput
						ref={chatInputRef}
						key={inputKey}
						onSend={handleSendMessage}
						onCommand={handleCommand}
						disabled={sendMessage.isPending}
						onConfigClick={handleToggleConfig}
						onPlanModeToggle={handlePlanModeToggle}
						isPlanMode={agent === 'plan'}
						reasoningEnabled={
							modelSupportsReasoning && preferences.reasoningEnabled
						}
						sessionId={sessionId}
						images={images}
						documents={documents}
						onFileRemove={removeFile}
						isDragging={isDragging}
						onPaste={handlePaste}
						visionEnabled={modelSupportsVision}
						modelName={model}
						providerName={provider}
						authType={providerAuthType}
						researchContexts={researchContexts}
						onResearchContextRemove={handleResearchContextRemove}
					/>
				</>
			);
		},
	),
);
