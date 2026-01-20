import { memo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { User, X, FileText, FileIcon, Clock, Trash2, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../../types/api';
import { useMessageQueuePosition } from '../../hooks/useQueueState';
import { useQueueStore } from '../../stores/queueStore';
import { apiClient } from '../../lib/api-client';

interface UserMessageGroupProps {
	sessionId?: string;
	message: Message;
	isFirst: boolean;
	nextAssistantMessageId?: string;
}

interface ImageData {
	data: string;
	mediaType: string;
}

interface FileData {
	type: 'image' | 'pdf' | 'text';
	name: string;
	data: string;
	mediaType: string;
	textContent?: string;
}

export const UserMessageGroup = memo(
	function UserMessageGroup({
		sessionId,
		message,
		nextAssistantMessageId,
	}: UserMessageGroupProps) {
		const [expandedImage, setExpandedImage] = useState<string | null>(null);
		const parts = message.parts || [];
		const queryClient = useQueryClient();

		const { isQueued, position } = useMessageQueuePosition(
			sessionId,
			nextAssistantMessageId ?? '',
		);
		const setPendingRestoreText = useQueueStore(
			(state) => state.setPendingRestoreText,
		);

		const textParts = parts.filter((p) => p.type === 'text');
		const imageParts = parts.filter((p) => p.type === 'image');
		const fileParts = parts.filter((p) => p.type === 'file');

		const firstTextPart = textParts[0];
		let content = '';

		if (firstTextPart) {
			const data = firstTextPart.contentJson || firstTextPart.content;
			if (data && typeof data === 'object' && 'text' in data) {
				content = String(data.text);
			} else if (typeof data === 'string') {
				content = data;
			} else if (data) {
				content = JSON.stringify(data, null, 2);
			}
		}

		const images: Array<{ id: string; src: string }> = [];
		for (const part of imageParts) {
			try {
				const data = part.contentJson || JSON.parse(part.content || '{}');
				if (data && typeof data === 'object' && 'data' in data) {
					const imgData = data as ImageData;
					const src = `data:${imgData.mediaType};base64,${imgData.data}`;
					images.push({ id: part.id, src });
				}
			} catch {}
		}

		const files: Array<{ id: string; type: string; name: string }> = [];
		for (const part of fileParts) {
			try {
				const data = part.contentJson || JSON.parse(part.content || '{}');
				if (data && typeof data === 'object' && 'type' in data) {
					const fileData = data as FileData;
					if (fileData.type === 'image' && fileData.data) {
						const src = `data:${fileData.mediaType};base64,${fileData.data}`;
						images.push({ id: part.id, src });
					} else {
						files.push({
							id: part.id,
							type: fileData.type,
							name: fileData.name,
						});
					}
				}
			} catch {}
		}

		const formatTime = (ts?: number) => {
			if (!ts) return '';
			const date = new Date(ts);
			return date.toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
			});
		};

		const hasContent = content.trim().length > 0;
		const hasImages = images.length > 0;
		const hasFiles = files.length > 0;

		if (!hasContent && !hasImages && !hasFiles) return null;

		const handleCancel = async () => {
			if (!sessionId || !nextAssistantMessageId) return;
			setPendingRestoreText(content);
			try {
				await apiClient.removeFromQueue(sessionId, nextAssistantMessageId);
				// Invalidate messages to refresh UI
				queryClient.invalidateQueries({ queryKey: ['messages', sessionId] });
			} catch (err) {
				console.error('Failed to cancel queued message:', err);
			}
		};

		const handleDelete = async () => {
			if (!sessionId || !nextAssistantMessageId) return;
			try {
				await apiClient.removeFromQueue(sessionId, nextAssistantMessageId);
				// Invalidate messages to refresh UI
				queryClient.invalidateQueries({ queryKey: ['messages', sessionId] });
			} catch (err) {
				console.error('Failed to delete queued message:', err);
			}
		};

		return (
			<>
				<div className="relative pb-8 pt-6">
					<div className="flex gap-3 md:gap-4 justify-end">
						<div className="flex flex-col items-end min-w-0 flex-1 max-w-[calc(100%-3rem)] md:max-w-2xl">
							<div className="flex items-center gap-2 text-xs text-muted-foreground pb-2 justify-end">
								<span className="font-medium text-emerald-700 dark:text-emerald-300">
									You
								</span>
								{message.createdAt && <span>·</span>}
								{message.createdAt && (
									<span>{formatTime(message.createdAt)}</span>
								)}
								{isQueued && (
									<>
										<span>·</span>
										<span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
											<Clock className="h-3 w-3" />
											Queued{position !== null && position > 0 ? ` #${position + 1}` : ''}
										</span>
									</>
								)}
							</div>
							<div className="inline-block max-w-full text-sm text-foreground leading-relaxed bg-emerald-500/5 border border-emerald-500/20 rounded-xl px-4 py-3 [word-break:break-word] overflow-hidden">
								{hasImages && (
									<div className="flex flex-wrap gap-2 mb-2">
										{images.map((img) => (
											<button
												key={img.id}
												type="button"
												onClick={() => setExpandedImage(img.src)}
												className="w-16 h-16 rounded-lg overflow-hidden bg-muted hover:ring-2 hover:ring-primary/50 transition-all"
											>
												<img
													src={img.src}
													alt="Attachment"
													className="w-full h-full object-cover"
												/>
											</button>
										))}
									</div>
								)}
								{hasFiles && (
									<div className="flex flex-wrap gap-2 mb-2">
										{files.map((file) => (
											<div
												key={file.id}
												className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border"
											>
												{file.type === 'pdf' ? (
													<FileIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
												) : (
													<FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
												)}
												<span className="text-xs truncate max-w-[150px]">
													{file.name}
												</span>
											</div>
										))}
									</div>
								)}
								{hasContent && (
									<div className="prose prose-invert prose-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_*]:[word-break:break-word] [&_*]:overflow-wrap-anywhere">
										<ReactMarkdown remarkPlugins={[remarkGfm]}>
											{content}
										</ReactMarkdown>
									</div>
								)}
							</div>
							{isQueued && (
								<div className="flex items-center gap-2 mt-2">
									<button
										type="button"
										onClick={handleCancel}
										className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
										title="Cancel and restore to input"
									>
										<RotateCcw className="h-3 w-3" />
										Cancel
									</button>
									<button
										type="button"
										onClick={handleDelete}
										className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
										title="Delete from queue"
									>
										<Trash2 className="h-3 w-3" />
										Delete
									</button>
								</div>
							)}
						</div>
						<div className="flex-shrink-0 w-8 flex items-start justify-center">
							<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500/50 bg-emerald-500/20 dark:bg-emerald-500/10 relative bg-background">
								<User className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
							</div>
						</div>
					</div>
				</div>

				{expandedImage && (
					<div
						role="dialog"
						aria-modal="true"
						className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
						onClick={() => setExpandedImage(null)}
						onKeyDown={(e) => e.key === 'Escape' && setExpandedImage(null)}
						tabIndex={-1}
					>
						<button
							type="button"
							onClick={() => setExpandedImage(null)}
							className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
						>
							<X className="w-6 h-6 text-white" />
						</button>
						<img
							src={expandedImage}
							alt="Expanded attachment"
							className="max-w-full max-h-full object-contain rounded-lg"
							onClick={(e) => e.stopPropagation()}
							onKeyDown={(e) => e.key === 'Enter' && e.stopPropagation()}
						/>
					</div>
				)}
			</>
		);
	},
	(prevProps, nextProps) => {
		const prevFirstPart = prevProps.message.parts?.[0];
		const nextFirstPart = nextProps.message.parts?.[0];

		return (
			prevProps.message.id === nextProps.message.id &&
			prevFirstPart?.content === nextFirstPart?.content &&
			prevFirstPart?.contentJson === nextFirstPart?.contentJson &&
			prevProps.message.createdAt === nextProps.message.createdAt &&
			prevProps.message.parts?.length === nextProps.message.parts?.length &&
			prevProps.sessionId === nextProps.sessionId &&
			prevProps.nextAssistantMessageId === nextProps.nextAssistantMessageId
		);
	},
);
