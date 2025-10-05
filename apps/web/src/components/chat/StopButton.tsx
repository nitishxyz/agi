import { StopCircle } from 'lucide-react';
import { useState } from 'react';
import { apiClient } from '../../lib/api-client';

interface StopButtonProps {
	sessionId: string;
	onStop?: () => void;
	disabled?: boolean;
}

export function StopButton({ sessionId, onStop, disabled }: StopButtonProps) {
	const [isAborting, setIsAborting] = useState(false);

	const handleStop = async () => {
		if (isAborting) return;
		setIsAborting(true);

		try {
			await apiClient.abortSession(sessionId);
			onStop?.();
		} catch (error) {
			console.error('Failed to abort stream:', error);
		} finally {
			// Keep button disabled for a bit to prevent double-clicks
			setTimeout(() => setIsAborting(false), 1000);
		}
	};

	return (
		<button
			onClick={handleStop}
			disabled={disabled || isAborting}
			className="flex items-center gap-1.5 text-sm text-destructive hover:text-destructive/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			title="Stop generation"
		>
			<StopCircle className="w-4 h-4" />
			<span className="font-medium">
				{isAborting ? 'Stopping...' : 'Stop'}
			</span>
		</button>
	);
}
