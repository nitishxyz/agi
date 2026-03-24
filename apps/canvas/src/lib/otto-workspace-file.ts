import { parse, stringify } from 'yaml';
import {
	COMMAND_PRESET_IDS,
	type CommandPresetId,
} from './primitive-registry';
import type {
	Block,
	LayoutNode,
	WorkspaceSurfaceState,
	WorkspaceTabState,
} from '../stores/canvas-store';
import type {
	Workspace,
	WorkspaceAutomationConfig,
	WorkspaceEnsureStep,
	WorkspaceStartupStep,
} from '../stores/workspace-store';

export interface OttoWorkspaceFile {
	version: 1;
	workspace: {
		name: string;
		activeTabId?: string | null;
	};
	ensure: WorkspaceEnsureStep[];
	startup: WorkspaceStartupStep[];
	tabs: OttoWorkspaceTab[];
}

export type OttoWorkspaceTab = OttoCanvasTab | OttoBlockTab;

export interface OttoCanvasTab {
	id: string;
	type: 'canvas';
	title: string;
	focusedBlockId?: string | null;
	layout: LayoutNode | null;
	blocks: OttoBlockFile[];
}

export interface OttoBlockTab {
	id: string;
	type: 'block';
	title: string;
	block: OttoBlockFile;
}

export interface OttoBlockFile {
	id: string;
	type: Exclude<Block['type'], 'pending'>;
	label: string;
	url?: string;
	reloadToken?: number;
	sessionId?: string;
	command?: string;
	cwd?: string;
	preset?: string;
}

interface ParsedOttoWorkspace {
	workspaceName: string;
	surfaceState: WorkspaceSurfaceState;
	automation: WorkspaceAutomationConfig;
}

function generateId() {
	return crypto.randomUUID().slice(0, 8);
}

function serializeBlock(block: Block): OttoBlockFile | null {
	if (block.type === 'pending') return null;
	return {
		id: block.id,
		type: block.type,
		label: block.label,
		url: block.url,
		reloadToken: block.reloadToken,
		sessionId: block.sessionId,
		command: block.command,
		cwd: block.cwd,
		preset: block.presetId,
	};
}

function deserializeBlock(block: OttoBlockFile): Block {
	const presetId =
		block.type === 'command' && block.preset && COMMAND_PRESET_IDS.includes(block.preset as CommandPresetId)
			? (block.preset as CommandPresetId)
			: undefined;
	return {
		id: block.id || generateId(),
		type: block.type,
		label: block.label,
		url: block.type === 'browser' ? block.url ?? '' : undefined,
		reloadToken: block.type === 'browser' ? block.reloadToken ?? 0 : undefined,
		sessionId: block.type === 'otto' ? block.sessionId : undefined,
		command: block.type === 'command' ? block.command ?? '' : undefined,
		cwd: block.type === 'command' ? block.cwd : undefined,
		presetId,
	};
}

function serializeTab(tab: WorkspaceTabState): OttoWorkspaceTab | null {
	if (tab.kind === 'pending') return null;
	if (tab.kind === 'canvas') {
		return {
			id: tab.id,
			type: 'canvas',
			title: tab.title,
			focusedBlockId: tab.focusedBlockId,
			layout: tab.layout,
			blocks: Object.values(tab.blocks)
				.map(serializeBlock)
				.filter((block): block is OttoBlockFile => block !== null),
		};
	}

	const block = serializeBlock(tab.block);
	if (!block) return null;
	return {
		id: tab.id,
		type: 'block',
		title: tab.title,
		block,
	};
}

function deserializeTabs(tabs: OttoWorkspaceTab[]): WorkspaceSurfaceState {
	const nextTabs: Record<string, WorkspaceTabState> = {};
	const tabOrder: string[] = [];

	for (const tab of tabs) {
		const tabId = tab.id || generateId();
		if (tab.type === 'canvas') {
			const blocks = Object.fromEntries(
				tab.blocks.map((block) => {
					const deserialized = deserializeBlock(block);
					return [deserialized.id, deserialized];
				}),
			);
			nextTabs[tabId] = {
				id: tabId,
				kind: 'canvas',
				title: tab.title,
				blocks,
				layout: tab.layout,
				focusedBlockId: tab.focusedBlockId ?? null,
				updatedAt: Date.now(),
			};
			tabOrder.push(tabId);
			continue;
		}

		nextTabs[tabId] = {
			id: tabId,
			kind: 'block',
			title: tab.title,
			block: deserializeBlock(tab.block),
			updatedAt: Date.now(),
		};
		tabOrder.push(tabId);
	}

	return {
		tabs: nextTabs,
		tabOrder,
		activeTabId: tabOrder[0] ?? null,
		updatedAt: Date.now(),
	};
}

function sanitizeEnsure(ensure: unknown): WorkspaceEnsureStep[] {
	if (!Array.isArray(ensure)) return [];
	return ensure
		.filter((item): item is WorkspaceEnsureStep => Boolean(item && typeof item === 'object'))
		.map((item) => ({
			id: item.id || generateId(),
			label: item.label,
			run: item.run,
			cwd: item.cwd,
			when: item.when,
		}))
		.filter((item) => typeof item.label === 'string' && typeof item.run === 'string');
}

function sanitizeStartup(startup: unknown): WorkspaceStartupStep[] {
	if (!Array.isArray(startup)) return [];
	return startup
		.filter((item): item is WorkspaceStartupStep => Boolean(item && typeof item === 'object'))
		.map((item): WorkspaceStartupStep => ({
			id: item.id || generateId(),
			label: item.label,
			run: item.run,
			cwd: item.cwd,
			policy: item.policy === 'onOpen' ? 'onOpen' : 'manual',
		}))
		.filter((item) => typeof item.label === 'string' && typeof item.run === 'string');
}

export function buildOttoWorkspaceFile(args: {
	workspace: Workspace;
	surfaceState: WorkspaceSurfaceState;
	automation: WorkspaceAutomationConfig;
}): OttoWorkspaceFile {
	const tabs = args.surfaceState.tabOrder
		.map((tabId) => args.surfaceState.tabs[tabId])
		.map((tab) => (tab ? serializeTab(tab) : null))
		.filter((tab): tab is OttoWorkspaceTab => tab !== null);

	return {
		version: 1,
		workspace: {
			name: args.workspace.name,
			activeTabId: args.surfaceState.activeTabId,
		},
		ensure: args.automation.ensure,
		startup: args.automation.startup,
		tabs,
	};
}

export function parseOttoWorkspaceFile(text: string): ParsedOttoWorkspace {
	const parsed = parse(text) as Partial<OttoWorkspaceFile> | null;
	if (!parsed || typeof parsed !== 'object') {
		throw new Error('otto.yaml did not contain a valid workspace object.');
	}
	if (parsed.version !== 1) {
		throw new Error(`Unsupported otto.yaml version: ${String(parsed.version)}`);
	}
	if (!parsed.workspace || typeof parsed.workspace.name !== 'string') {
		throw new Error('otto.yaml is missing workspace.name.');
	}
	if (!Array.isArray(parsed.tabs)) {
		throw new Error('otto.yaml is missing tabs.');
	}

	const tabs = parsed.tabs.map((tab) => {
		if (!tab || typeof tab !== 'object') {
			throw new Error('otto.yaml contains an invalid tab entry.');
		}
		if (tab.type === 'canvas') {
			return {
				id: typeof tab.id === 'string' ? tab.id : generateId(),
				type: 'canvas' as const,
				title: typeof tab.title === 'string' ? tab.title : 'Canvas',
				focusedBlockId:
					typeof tab.focusedBlockId === 'string' || tab.focusedBlockId === null
						? tab.focusedBlockId
						: null,
				layout: (tab.layout as LayoutNode | null | undefined) ?? null,
				blocks: Array.isArray(tab.blocks)
					? tab.blocks.filter((block): block is OttoBlockFile => Boolean(block && typeof block === 'object'))
					: [],
			};
		}
		if (tab.type === 'block' && tab.block && typeof tab.block === 'object') {
			return {
				id: typeof tab.id === 'string' ? tab.id : generateId(),
				type: 'block' as const,
				title: typeof tab.title === 'string' ? tab.title : 'Block',
				block: tab.block as OttoBlockFile,
			};
		}
		throw new Error('otto.yaml contains an unsupported tab type.');
	});

	const surfaceState = deserializeTabs(tabs);
	if (parsed.workspace.activeTabId && surfaceState.tabs[parsed.workspace.activeTabId]) {
		surfaceState.activeTabId = parsed.workspace.activeTabId;
	}

	return {
		workspaceName: parsed.workspace.name,
		surfaceState,
		automation: {
			ensure: sanitizeEnsure(parsed.ensure),
			startup: sanitizeStartup(parsed.startup),
		},
	};
}

export function stringifyOttoWorkspaceFile(file: OttoWorkspaceFile) {
	return stringify(file, {
		sortMapEntries: false,
		lineWidth: 0,
	});
}

export function getOttoWorkspaceFilePath(projectPath: string) {
	return `${projectPath.replace(/[\\/]+$/, '')}/otto.yaml`;
}
