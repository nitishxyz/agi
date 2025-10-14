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
						await sendMessage.mutateAsync({
							content,
							agent: agent || undefined,
							provider: provider || undefined,
							model: model || undefined,
							userContext: userContext || undefined,
						});
					} catch (error) {
						console.error('Failed to send message:', error);
					}
				},
				[sendMessage, agent, provider, model, userContext],
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
					}
				},
				[onNewSession],
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
					/>
				</>
			);
		},
	),
);
