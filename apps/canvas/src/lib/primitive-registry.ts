import { Globe, Play, type LucideIcon } from 'lucide-react';
import { ClaudeIcon, GhosttyIcon, OpenAIIcon, OpenCodeIcon, OttoIcon } from '../components/icons/BrandIcons';

export const PRIMITIVE_BLOCK_TYPES = ['terminal', 'browser', 'otto', 'command'] as const;
export type PrimitiveBlockType = (typeof PRIMITIVE_BLOCK_TYPES)[number];
export type PrimitiveTabKind = PrimitiveBlockType;
export const COMMAND_PRESET_IDS = ['claude-code', 'codex', 'otto-tui', 'opencode'] as const;
export type CommandPresetId = (typeof COMMAND_PRESET_IDS)[number];
export type SidebarPrimitiveGroup = 'agents' | 'browsers' | 'terminal' | 'commands';

export interface PrimitiveDefinition {
	kind: PrimitiveBlockType;
	label: string;
	description: string;
	icon: LucideIcon | React.ComponentType<{ size?: number | string; className?: string; strokeWidth?: number }>;
	sidebarDescription: string;
	sidebarGroup: SidebarPrimitiveGroup;
	blockShortcut: string;
	tabShortcut: string;
	nativeHostKind?: 'terminal' | 'browser';
}

export interface CommandPresetDefinition {
	id: CommandPresetId;
	label: string;
	description: string;
	icon: LucideIcon | React.ComponentType<{ size?: number | string; className?: string; strokeWidth?: number }>;
	command: string;
	blockShortcut: string;
	tabShortcut: string;
	sidebarDescription: string;
	sidebarGroup: SidebarPrimitiveGroup;
}

export interface CreationOption {
	key: string;
	label: string;
	description: string;
	icon: LucideIcon | React.ComponentType<{ size?: number | string; className?: string; strokeWidth?: number }>;
	value:
		| { kind: 'primitive'; primitive: PrimitiveBlockType }
		| { kind: 'preset'; preset: CommandPresetId };
}

export const PRIMITIVE_DEFINITIONS: Record<PrimitiveBlockType, PrimitiveDefinition> = {
	terminal: {
		kind: 'terminal',
		label: 'Ghostty',
		description: 'A focused terminal or command surface.',
		icon: GhosttyIcon,
		sidebarDescription: 'Focused terminal surface',
		sidebarGroup: 'terminal',
		blockShortcut: '1',
		tabShortcut: '2',
		nativeHostKind: 'terminal',
	},
	browser: {
		kind: 'browser',
		label: 'Browser',
		description: 'A full browser preview or docs tab.',
		icon: Globe,
		sidebarDescription: 'Focused browser surface',
		sidebarGroup: 'browsers',
		blockShortcut: '2',
		tabShortcut: '3',
		nativeHostKind: 'browser',
	},
	otto: {
		kind: 'otto',
		label: 'Otto',
		description: 'A focused Otto block as its own tab.',
		icon: OttoIcon,
		sidebarDescription: 'Focused agent surface',
		sidebarGroup: 'agents',
		blockShortcut: '3',
		tabShortcut: '4',
	},
	command: {
		kind: 'command',
		label: 'Custom command',
		description: 'Run a custom command in a Ghostty-backed surface.',
		icon: Play,
		sidebarDescription: 'Focused command surface',
		sidebarGroup: 'commands',
		blockShortcut: '8',
		tabShortcut: '9',
		nativeHostKind: 'terminal',
	},
};

export const COMMAND_PRESET_DEFINITIONS: Record<CommandPresetId, CommandPresetDefinition> = {
	'claude-code': {
		id: 'claude-code',
		label: 'Claude Code',
		description: 'Launch Claude Code inside a Ghostty-backed surface.',
		icon: ClaudeIcon,
		command: 'claude',
		blockShortcut: '4',
		tabShortcut: '5',
		sidebarDescription: 'Claude Code command surface',
		sidebarGroup: 'agents',
	},
	codex: {
		id: 'codex',
		label: 'Codex',
		description: 'Launch Codex inside a Ghostty-backed surface.',
		icon: OpenAIIcon,
		command: 'codex',
		blockShortcut: '5',
		tabShortcut: '6',
		sidebarDescription: 'Codex command surface',
		sidebarGroup: 'agents',
	},
	'otto-tui': {
		id: 'otto-tui',
		label: 'Otto TUI',
		description: 'Launch the Otto terminal UI inside a Ghostty-backed surface.',
		icon: OttoIcon,
		command: 'otto',
		blockShortcut: '6',
		tabShortcut: '7',
		sidebarDescription: 'Otto terminal UI surface',
		sidebarGroup: 'agents',
	},
	opencode: {
		id: 'opencode',
		label: 'OpenCode',
		description: 'Launch OpenCode inside a Ghostty-backed surface.',
		icon: OpenCodeIcon,
		command: 'opencode',
		blockShortcut: '7',
		tabShortcut: '8',
		sidebarDescription: 'OpenCode command surface',
		sidebarGroup: 'agents',
	},
};

const NON_COMMAND_BLOCK_TYPES = (['terminal', 'browser', 'otto'] as const);

const primitiveBlockOptions = NON_COMMAND_BLOCK_TYPES.map((kind): CreationOption => {
	const primitive = PRIMITIVE_DEFINITIONS[kind];
	return {
		key: primitive.blockShortcut,
		label: primitive.label,
		icon: primitive.icon,
		description: primitive.description,
		value: { kind: 'primitive', primitive: kind },
	};
});

const presetBlockOptions = COMMAND_PRESET_IDS.map((presetId): CreationOption => {
	const preset = COMMAND_PRESET_DEFINITIONS[presetId];
	return {
		key: preset.blockShortcut,
		label: preset.label,
		icon: preset.icon,
		description: preset.description,
		value: { kind: 'preset', preset: presetId },
	};
});

const commandBlockOption: CreationOption = {
	key: PRIMITIVE_DEFINITIONS.command.blockShortcut,
	label: PRIMITIVE_DEFINITIONS.command.label,
	icon: PRIMITIVE_DEFINITIONS.command.icon,
	description: PRIMITIVE_DEFINITIONS.command.description,
	value: { kind: 'primitive', primitive: 'command' },
};

export const BLOCK_PRIMITIVE_OPTIONS: CreationOption[] = [
	...primitiveBlockOptions,
	...presetBlockOptions,
	commandBlockOption,
];

const primitiveTabOptions = NON_COMMAND_BLOCK_TYPES.map((kind): CreationOption => {
	const primitive = PRIMITIVE_DEFINITIONS[kind];
	return {
		key: primitive.tabShortcut,
		label: primitive.label,
		icon: primitive.icon,
		description: primitive.description,
		value: { kind: 'primitive', primitive: kind },
	};
});

const presetTabOptions = COMMAND_PRESET_IDS.map((presetId): CreationOption => {
	const preset = COMMAND_PRESET_DEFINITIONS[presetId];
	return {
		key: preset.tabShortcut,
		label: preset.label,
		icon: preset.icon,
		description: preset.description,
		value: { kind: 'preset', preset: presetId },
	};
});

const commandTabOption: CreationOption = {
	key: PRIMITIVE_DEFINITIONS.command.tabShortcut,
	label: PRIMITIVE_DEFINITIONS.command.label,
	icon: PRIMITIVE_DEFINITIONS.command.icon,
	description: PRIMITIVE_DEFINITIONS.command.description,
	value: { kind: 'primitive', primitive: 'command' },
};

export const TAB_PRIMITIVE_OPTIONS: CreationOption[] = [
	...primitiveTabOptions,
	...presetTabOptions,
	commandTabOption,
];

export function getPrimitiveDefinition(kind: PrimitiveBlockType) {
	return PRIMITIVE_DEFINITIONS[kind];
}

export function getCommandPresetDefinition(presetId: CommandPresetId) {
	return COMMAND_PRESET_DEFINITIONS[presetId];
}

export function getPrimitiveLabel(kind: PrimitiveBlockType) {
	return PRIMITIVE_DEFINITIONS[kind].label;
}

export function getCommandSurfaceDefinition(presetId?: CommandPresetId) {
	return presetId ? COMMAND_PRESET_DEFINITIONS[presetId] : PRIMITIVE_DEFINITIONS.command;
}
