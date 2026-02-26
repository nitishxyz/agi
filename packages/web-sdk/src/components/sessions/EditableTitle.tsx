import { useState, useRef, useEffect, useCallback } from 'react';
import { Pencil } from 'lucide-react';
import { useUpdateSession } from '../../hooks/useSessions';

interface EditableTitleProps {
	sessionId: string;
	title: string | null;
	className?: string;
}

export function EditableTitle({
	sessionId,
	title,
	className = '',
}: EditableTitleProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(title || '');
	const inputRef = useRef<HTMLInputElement>(null);
	const { mutate: updateSession } = useUpdateSession(sessionId);

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus();
			inputRef.current.select();
		}
	}, [isEditing]);

	useEffect(() => {
		setDraft(title || '');
	}, [title]);

	const save = useCallback(() => {
		const trimmed = draft.trim();
		if (trimmed && trimmed !== (title || '')) {
			updateSession({ title: trimmed });
		}
		setIsEditing(false);
	}, [draft, title, updateSession]);

	const cancel = useCallback(() => {
		setDraft(title || '');
		setIsEditing(false);
	}, [title]);

	if (isEditing) {
		return (
			<input
				ref={inputRef}
				type="text"
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={save}
				onKeyDown={(e) => {
					if (e.key === 'Enter') save();
					if (e.key === 'Escape') cancel();
				}}
				className={`w-full bg-muted/30 text-foreground rounded px-2 py-1 outline-none ring-1 ring-primary/50 focus:ring-primary ${className}`}
			/>
		);
	}

	return (
		<button
			type="button"
			onClick={() => setIsEditing(true)}
			className={`group flex items-center gap-2 hover:opacity-80 transition-opacity truncate text-left ${className}`}
			title="Click to edit title"
		>
			<span className="truncate">{title || 'Untitled Session'}</span>
			<Pencil className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50 flex-shrink-0 transition-opacity" />
		</button>
	);
}
