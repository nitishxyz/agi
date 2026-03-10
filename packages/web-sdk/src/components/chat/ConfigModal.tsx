import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { useConfig, useUpdateDefaults } from '../../hooks/useConfig';
import { Modal } from '../ui/Modal';
import {
	UnifiedModelSelector,
	type UnifiedModelSelectorRef,
} from './UnifiedModelSelector';
import {
	UnifiedAgentSelector,
	type UnifiedAgentSelectorRef,
} from './UnifiedAgentSelector';

type ReasoningLevel = 'minimal' | 'low' | 'medium' | 'high' | 'max' | 'xhigh';

const REASONING_LEVELS: { value: ReasoningLevel; label: string }[] = [
	{ value: 'minimal', label: 'Minimal' },
	{ value: 'low', label: 'Low' },
	{ value: 'medium', label: 'Medium' },
	{ value: 'high', label: 'High' },
	{ value: 'max', label: 'Max' },
	{ value: 'xhigh', label: 'X-High' },
];

function ReasoningTabs({
	value,
	onChange,
	disabled,
}: {
	value: ReasoningLevel;
	onChange: (level: ReasoningLevel) => void;
	disabled: boolean;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });

	useLayoutEffect(() => {
		if (!containerRef.current) return;
		const activeIndex = REASONING_LEVELS.findIndex((l) => l.value === value);
		const buttons = containerRef.current.querySelectorAll<HTMLButtonElement>('[data-tab]');
		const activeBtn = buttons[activeIndex];
		if (activeBtn) {
			setPillStyle({
				left: activeBtn.offsetLeft,
				width: activeBtn.offsetWidth,
			});
		}
	}, [value]);

	return (
		<div
			ref={containerRef}
			className={`relative flex rounded-full bg-muted p-1 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
		>
			<div
				className="absolute top-1 bottom-1 rounded-full bg-foreground shadow-md"
				style={{
					left: pillStyle.left,
					width: pillStyle.width,
					transition: 'left 200ms ease, width 200ms ease',
				}}
			/>
			{REASONING_LEVELS.map((level) => (
				<button
					key={level.value}
					data-tab
					type="button"
					onClick={() => onChange(level.value)}
					disabled={disabled}
				className={`relative z-10 flex-1 px-3 py-1.5 text-xs font-medium rounded-full transition-colors duration-200 ${
					value === level.value
							? 'text-background'
							: 'text-muted-foreground hover:text-foreground'
					}`}
				>
					{level.label}
				</button>
			))}
		</div>
	);
}

interface ConfigModalProps {
	isOpen: boolean;
	onClose: () => void;
	initialFocus?: 'agent' | 'model' | null;
	chatInputRef?: React.RefObject<{ focus: () => void }>;
	agent: string;
	provider: string;
	model: string;
	modelSupportsReasoning?: boolean;
	onAgentChange: (agent: string) => void;
	onProviderChange: (provider: string) => void;
	onModelChange: (model: string) => void;
	onModelSelectorChange?: (provider: string, model: string) => void;
}

export function ConfigModal({
	isOpen,
	onClose,
	initialFocus,
	chatInputRef,
	agent,
	provider,
	model,
	modelSupportsReasoning,
	onAgentChange,
	onProviderChange,
	onModelChange,
	onModelSelectorChange,
}: ConfigModalProps) {
	const { data: config, isLoading: configLoading } = useConfig();
	const updateDefaults = useUpdateDefaults();
	const reasoningEnabled = config?.defaults?.reasoningText ?? true;
	const reasoningLevel = config?.defaults?.reasoningLevel ?? 'high';
	const agentSelectorRef = useRef<UnifiedAgentSelectorRef>(null);
	const modelSelectorRef = useRef<UnifiedModelSelectorRef>(null);

	useEffect(() => {
		if (isOpen && initialFocus) {
			setTimeout(() => {
				if (initialFocus === 'agent') {
					agentSelectorRef.current?.openAndFocus();
				} else if (initialFocus === 'model') {
					modelSelectorRef.current?.openAndFocus();
				}
			}, 100);
		}
	}, [isOpen, initialFocus]);

	const handleClose = () => {
		onClose();
		setTimeout(() => {
			chatInputRef?.current?.focus();
		}, 100);
	};

	const handleModelChange = (
		selectedProvider: string,
		selectedModel: string,
	) => {
		if (onModelSelectorChange) {
			onModelSelectorChange(selectedProvider, selectedModel);
		} else {
			onProviderChange(selectedProvider);
			onModelChange(selectedModel);
		}
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			title="Configuration"
			closeOnEscape={true}
			closeOnBackdropClick={true}
			maxWidth="lg"
		>
			{configLoading ? (
				<div className="text-center text-muted-foreground py-8">
					Loading configuration...
				</div>
			) : config ? (
				<div className="space-y-4">
					{modelSupportsReasoning && (
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<div className="text-sm font-medium text-foreground">
									Extended Thinking
								</div>
								<button
									type="button"
									role="switch"
									aria-checked={reasoningEnabled}
									onClick={() =>
										updateDefaults.mutate({
											reasoningText: !reasoningEnabled,
											scope: 'global',
										})
									}
									className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
										reasoningEnabled ? 'bg-primary' : 'bg-muted'
									}`}
								>
									<span
										className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
											reasoningEnabled ? 'translate-x-6' : 'translate-x-1'
										} ${reasoningEnabled ? 'bg-primary-foreground' : 'bg-foreground'}`}
									/>
								</button>
							</div>
							<ReasoningTabs
								value={reasoningLevel as ReasoningLevel}
								onChange={(level) =>
									updateDefaults.mutate({
										reasoningLevel: level,
										scope: 'global',
									})
								}
								disabled={!reasoningEnabled}
							/>
						</div>
					)}

					<div>
						<div className="block text-sm font-medium text-foreground mb-2">
							Agent
						</div>
						<UnifiedAgentSelector
							ref={agentSelectorRef}
							agent={agent}
							agents={config.agents}
							onChange={onAgentChange}
						/>
					</div>

					<div>
						<div className="block text-sm font-medium text-foreground mb-2">
							Provider / Model
						</div>
						<UnifiedModelSelector
							ref={modelSelectorRef}
							provider={provider}
							model={model}
							onChange={handleModelChange}
						/>
					</div>
				</div>
			) : null}
		</Modal>
	);
}
