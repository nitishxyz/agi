import { useRenderer, useKeyboard } from '@opentui/react';
import { TextareaRenderable } from '@opentui/core';
import { useEffect, useRef, useState, useCallback } from 'react';
import { colors } from '../theme.ts';
import { COMMANDS } from '../commands.ts';

interface ChatInputProps {
	onSubmit: (text: string) => void;
	disabled: boolean;
}

export function ChatInput({ onSubmit, disabled }: ChatInputProps) {
	const renderer = useRenderer();
	const textareaRef = useRef<TextareaRenderable | null>(null);
	const containerRef = useRef<string>(`chat-input-${Date.now()}`);
	const [commandMatches, setCommandMatches] = useState<typeof COMMANDS>([]);
	const [selectedIdx, setSelectedIdx] = useState(0);
	const commandMatchesRef = useRef(commandMatches);
	const selectedIdxRef = useRef(selectedIdx);
	commandMatchesRef.current = commandMatches;
	selectedIdxRef.current = selectedIdx;

	const handleContentChange = useCallback(() => {
		if (!textareaRef.current) return;
		const text = textareaRef.current.plainText;
		if (text.startsWith('/') && !text.includes(' ')) {
			const query = text.slice(1).toLowerCase();
		const matches = query.length === 0
				? COMMANDS
				: COMMANDS.filter(
						(c) => c.name.startsWith(query) || (c.alias && c.alias.slice(1).startsWith(query)),
					);
			setCommandMatches(matches);
			setSelectedIdx(0);
		} else {
			setCommandMatches([]);
		}
	}, []);

	const handleSubmit = useCallback(() => {
		if (!textareaRef.current) return;
		const matches = commandMatchesRef.current;
		const idx = selectedIdxRef.current;
		if (matches.length > 0 && idx >= 0 && idx < matches.length) {
			const cmd = matches[idx];
			textareaRef.current.clear();
			setCommandMatches([]);
			onSubmit(`/${cmd.name}`);
			return;
		}
		const text = textareaRef.current.plainText.trim();
		if (!text) return;
		onSubmit(text);
		textareaRef.current.clear();
		setCommandMatches([]);
	}, [onSubmit]);

	useKeyboard((key) => {
		if (commandMatchesRef.current.length === 0) return;
		if (key.name === 'up') {
			setSelectedIdx((prev) => {
				const next = prev - 1;
				return next < 0 ? commandMatchesRef.current.length - 1 : next;
			});
		} else if (key.name === 'down') {
			setSelectedIdx((prev) => {
				const next = prev + 1;
				return next >= commandMatchesRef.current.length ? 0 : next;
			});
		} else if (key.name === 'tab') {
			const matches = commandMatchesRef.current;
			const idx = selectedIdxRef.current;
			if (matches.length > 0 && idx >= 0 && idx < matches.length && textareaRef.current) {
				textareaRef.current.clear();
				textareaRef.current.insertText(`/${matches[idx].name}`);
				handleContentChange();
			}
		} else if (key.name === 'escape') {
			setCommandMatches([]);
		}
	});

	useEffect(() => {
		const container = renderer.root.findDescendantById(containerRef.current);
		if (!container || textareaRef.current) return;

		const textarea = new TextareaRenderable(renderer, {
			id: 'chat-textarea',
			width: '100%',
			height: 3,
			placeholder: 'Message otto…  ↵ send  ⇧↵ newline  / commands',
			placeholderColor: colors.fgDark,
			backgroundColor: colors.bg,
			focusedBackgroundColor: colors.bg,
			textColor: colors.fgBright,
			focusedTextColor: colors.fgBright,
			cursorColor: colors.blue,
			wrapMode: 'word',
			keyBindings: [
				{ name: 'return', action: 'submit' },
				{ name: 'return', shift: true, action: 'newline' },
			],
			onSubmit: handleSubmit,
		});

		textarea.onContentChange = handleContentChange;

		container.add(textarea);
		textareaRef.current = textarea;
		textarea.focus();

		return () => {
			if (textareaRef.current) {
				textareaRef.current.destroy();
				textareaRef.current = null;
			}
		};
	}, [renderer, handleContentChange]);

	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.onSubmit = handleSubmit;
		}
	}, [handleSubmit]);

	return (
		<box
			style={{
				width: '100%',
				flexShrink: 0,
				paddingLeft: 1,
				paddingRight: 1,
				flexDirection: 'column',
			}}
		>
		{commandMatches.length > 0 && (
		<box
				style={{
					flexDirection: 'column',
					backgroundColor: colors.bgHighlight,
					borderStyle: 'rounded',
					border: true,
					borderColor: colors.border,
					paddingLeft: 1,
					paddingRight: 1,
					width: '100%',
				}}
			>
				{commandMatches.map((cmd, i) => (
					<box
						key={cmd.name}
						style={{
							flexDirection: 'row',
							gap: 1,
							height: 1,
							width: '100%',
							backgroundColor: i === selectedIdx ? colors.bgSubtle : undefined,
						}}
					>
						<text fg={i === selectedIdx ? colors.green : colors.fgMuted}>/{cmd.name}</text>
						<text fg={i === selectedIdx ? colors.fgMuted : colors.fgDark}>{cmd.description}</text>
					</box>
				))}
			</box>
			)}
			<box
				id={containerRef.current}
				style={{
					width: '100%',
					minHeight: 3,
					maxHeight: 5,
					borderStyle: 'rounded',
					border: true,
					borderColor: disabled ? colors.border : colors.fgDimmed,
				}}
			/>
		</box>
	);
}
