import { useState, useId } from 'react';
import { X, GitCommit, Sparkles, Loader2 } from 'lucide-react';
import { useGitStore } from '../../stores/gitStore';
import { useCommitChanges, useGenerateCommitMessage } from '../../hooks/useGit';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';

export function GitCommitModal() {
	const { isCommitModalOpen, closeCommitModal } = useGitStore();
	const commitChanges = useCommitChanges();
	const generateMessage = useGenerateCommitMessage();
	const [message, setMessage] = useState('');
	const messageId = useId();

	if (!isCommitModalOpen) return null;

	const handleCommit = async () => {
		if (!message.trim()) return;

		try {
			await commitChanges.mutateAsync(message);
			setMessage('');
			closeCommitModal();
		} catch (error) {
			console.error('Failed to commit:', error);
		}
	};

	const handleClose = () => {
		setMessage('');
		closeCommitModal();
	};

	const handleGenerateMessage = async () => {
		try {
			const result = await generateMessage.mutateAsync();
			setMessage(result.message);
		} catch (error) {
			console.error('Failed to generate commit message:', error);
		}
	};

	return (
		<div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
			<div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-2xl">
				{/* Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-border">
					<div className="flex items-center gap-2">
						<GitCommit className="w-5 h-5 text-foreground" />
						<h2 className="text-lg font-semibold text-foreground">
							Commit Changes
						</h2>
					</div>
					<Button variant="ghost" size="icon" onClick={handleClose}>
						<X className="w-4 h-4" />
					</Button>
				</div>

				{/* Body */}
				<div className="p-6 space-y-4">
					<div className="space-y-2">
						<label
							htmlFor={messageId}
							className="text-sm font-medium text-foreground"
						>
							Commit Message
						</label>
						<Textarea
							id={messageId}
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							placeholder="Enter commit message..."
							rows={6}
							className="w-full resize-none"
							autoFocus
							disabled={generateMessage.isPending}
						/>
					</div>

					<Button
						variant="secondary"
						size="sm"
						onClick={handleGenerateMessage}
						className="w-full"
						disabled={generateMessage.isPending}
					>
						{generateMessage.isPending ? (
							<>
								<Loader2 className="w-4 h-4 mr-2 animate-spin" />
								Generating...
							</>
						) : (
							<>
								<Sparkles className="w-4 h-4 mr-2" />
								Generate commit message with AI
							</>
						)}
					</Button>

					{generateMessage.isError && (
						<div className="text-sm text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
							{generateMessage.error?.message || 'Failed to generate commit message'}
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
					<Button variant="ghost" onClick={handleClose}>
						Cancel
					</Button>
					<Button
						variant="primary"
						onClick={handleCommit}
						disabled={!message.trim() || commitChanges.isPending}
					>
						{commitChanges.isPending ? (
							<span>Committing...</span>
						) : (
							<>
								<GitCommit className="w-4 h-4 mr-2" />
								Commit
							</>
						)}
					</Button>
				</div>

				{commitChanges.isError && (
					<div className="px-6 pb-4">
						<div className="text-sm text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
							{commitChanges.error?.message || 'Failed to commit changes'}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
