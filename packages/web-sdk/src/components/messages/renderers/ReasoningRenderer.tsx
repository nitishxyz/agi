import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { MessagePart } from '../../../types/api';

interface ReasoningRendererProps {
	part: MessagePart;
}

export function ReasoningRenderer({ part }: ReasoningRendererProps) {
	const [isExpanded, setIsExpanded] = useState(true);
	const scrollRef = useRef<HTMLDivElement>(null);
	let content = '';
	const data = part.contentJson || part.content;
	if (data && typeof data === 'object' && 'text' in data) {
		content = String(data.text);
	} else if (typeof data === 'string') {
		content = data;
	}

	useEffect(() => {
		if (scrollRef.current && isExpanded && !part.completedAt) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [content, isExpanded, part.completedAt]);

	if (!content || !content.trim()) {
		return null;
	}

	return (
		<div className="w-full">
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full py-0.5"
			>
				{isExpanded ? (
					<ChevronDown className="h-3.5 w-3.5" />
				) : (
					<ChevronRight className="h-3.5 w-3.5" />
				)}
				<span className="font-medium">Reasoning</span>
				{!part.completedAt && (
					<span className="text-muted-foreground/60 animate-pulse">
						thinking...
					</span>
				)}
			</button>
			{isExpanded && (
				<div
					ref={scrollRef}
					className="mt-2 p-3 bg-muted/30 rounded-md border border-border max-h-48 overflow-y-auto"
				>
					<div className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
						{content}
					</div>
				</div>
			)}
		</div>
	);
}
