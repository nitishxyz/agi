import {
	memo,
	useState,
	useCallback,
	useEffect,
	useRef,
	forwardRef,
	useImperativeHandle,
} from 'react';
import { useSendMessage } from '../../hooks/useMessages';
import { useSession, useUpdateSession } from '../../hooks/useSessions';
import { useAllModels } from '../../hooks/useConfig';
import { usePreferences } from '../../hooks/usePreferences';
import { useGitStatus, useStageFiles } from '../../hooks/useGit';
import { useGitStore } from '../../stores/gitStore';
import { useImageUpload } from '../../hooks/useImageUpload';
import { ChatInput } from './ChatInput';
import { ConfigModal } from './ConfigModal';

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

			const chatInputRef = useRef<{ focus: () => void }>(null);

			const sendMessage = useSendMessage(sessionId);
			const updateSession = useUpdateSession(sessionId);
			const { data: allModels } = useAllModels();
			const { preferences } = usePreferences();
			const { data: gitStatus } = useGitStatus();
			const stageFiles = useStageFiles();
			const openCommitModal = useGitStore((state) => state.openCommitModal);

			const { images, isDragging, removeImage, clearImages, handlePaste } =
				useImageUpload();

			const modelSupportsReasoning = allModels?.[provider]?.models?.find(
				(m) => m.id === model,
			)?.reasoning;

			const modelSupportsVision = allModels?.[provider]?.models?.find(
				(m) => m.id === model,
			)?.vision;

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

						await sendMessage.mutateAsync({
							content,
							images: imageData,
							agent: agent || undefined,
							provider: provider || undefined,
							model: model || undefined,
							userContext: userContext || undefined,
							reasoning:
								modelSupportsReasoning && preferences.reasoningEnabled
									? true
									: undefined,
						});

						clearImages();
					} catch (error) {
						console.error('Failed to send message:', error);
					}
				},
				[
					sendMessage,
					images,
					clearImages,
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
					}
				},
				[onNewSession, gitStatus, stageFiles, openCommitModal],
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
						onImageRemove={removeImage}
						isDragging={isDragging}
						onPaste={handlePaste}
						visionEnabled={modelSupportsVision}
					/>
				</>
			);
		},
	),
);
