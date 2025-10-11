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
import { ChatInput } from './ChatInput';
import { ConfigModal } from './ConfigModal';

interface ChatInputContainerProps {
	sessionId: string;
	userContext?: string;
}

export interface ChatInputContainerRef {
	focus: () => void;
}

export const ChatInputContainer = memo(
	forwardRef<ChatInputContainerRef, ChatInputContainerProps>(
		function ChatInputContainer({ sessionId, userContext }, ref) {
			const [agent, setAgent] = useState('');
			const [provider, setProvider] = useState('');
			const [model, setModel] = useState('');
			const [isConfigOpen, setIsConfigOpen] = useState(false);
			const [inputKey, setInputKey] = useState(0);

			const chatInputRef = useRef<{ focus: () => void }>(null);

			const sendMessage = useSendMessage(sessionId);

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
			}, []);

			const handleAgentChange = useCallback((value: string) => {
				setAgent(value);
			}, []);

			const handleProviderChange = useCallback((value: string) => {
				setProvider(value);
			}, []);

			const handleModelChange = useCallback((value: string) => {
				setModel(value);
			}, []);

			return (
				<>
					<ConfigModal
						isOpen={isConfigOpen}
						onClose={handleCloseConfig}
						agent={agent}
						provider={provider}
						model={model}
						onAgentChange={handleAgentChange}
						onProviderChange={handleProviderChange}
						onModelChange={handleModelChange}
					/>
					<ChatInput
						ref={chatInputRef}
						key={inputKey}
						onSend={handleSendMessage}
						disabled={sendMessage.isPending}
						onConfigClick={handleToggleConfig}
					/>
				</>
			);
		},
	),
);
