import { Bot, Code2, Globe, Play, Terminal, type LucideIcon } from 'lucide-react';

export const PRIMITIVE_BLOCK_TYPES = ['terminal', 'browser', 'otto', 'command'] as const;
export type PrimitiveBlockType = (typeof PRIMITIVE_BLOCK_TYPES)[number];
export type PrimitiveTabKind = PrimitiveBlockType;
export const COMMAND_PRESET_IDS = ['claude-code', 'codex'] as const;
export type CommandPresetId = (typeof COMMAND_PRESET_IDS)[number];
export type SidebarPrimitiveGroup = 'agents' | 'browsers' | 'terminal' | 'commands';

export interface PrimitiveDefinition {
	kind: PrimitiveBlockType;
	label: string;
	description: string;
	icon: LucideIcon;
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
	icon: LucideIcon;
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
	icon: LucideIcon;
	value:
		| { kind: 'primitive'; primitive: PrimitiveBlockType }
		| { kind: 'preset'; preset: CommandPresetId };
}

export const PRIMITIVE_DEFINITIONS: Record<PrimitiveBlockType, PrimitiveDefinition> = {
	terminal: {
		kind: 'terminal',
		label: 'Ghostty',
		description: 'A focused terminal or command surface.',
		icon: Terminal,
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
		icon: Bot,
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
		blockShortcut: '4',
		tabShortcut: '5',
		nativeHostKind: 'terminal',
	},
};

export const COMMAND_PRESET_DEFINITIONS: Record<CommandPresetId, CommandPresetDefinition> = {
	'claude-code': {
		id: 'claude-code',
		label: 'Claude Code',
		description: 'Launch Claude Code inside a Ghostty-backed surface.',
		icon: Bot,
		command: 'claude',
		blockShortcut: '5',
		tabShortcut: '6',
		sidebarDescription: 'Claude Code command surface',
		sidebarGroup: 'agents',
	},
	codex: {
		id: 'codex',
		label: 'Codex',
		description: 'Launch Codex inside a Ghostty-backed surface.',
		icon: Code2,
		command: 'codex',
		blockShortcut: '6',
		tabShortcut: '7',
		sidebarDescription: 'Codex command surface',
		sidebarGroup: 'agents',
	},
};

const primitiveBlockOptions = PRIMITIVE_BLOCK_TYPES.map((kind): CreationOption => {
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

export const BLOCK_PRIMITIVE_OPTIONS: CreationOption[] = [
	...primitiveBlockOptions,
	...presetBlockOptions,
];

const primitiveTabOptions = PRIMITIVE_BLOCK_TYPES.map((kind): CreationOption => {
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

export const TAB_PRIMITIVE_OPTIONS: CreationOption[] = [
	...primitiveTabOptions,
	...presetTabOptions,
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
