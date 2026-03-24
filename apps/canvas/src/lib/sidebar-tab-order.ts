import { getCommandSurfaceDefinition, getPrimitiveDefinition } from './primitive-registry';
import type { WorkspaceTabState } from '../stores/canvas-store';

export type SidebarGroupId =
	| 'drafts'
	| 'agents'
	| 'browsers'
	| 'terminal'
	| 'commands'
	| 'canvas';

export interface SidebarGroupDefinition {
	id: SidebarGroupId;
	label: string;
	matches: (tab: WorkspaceTabState) => boolean;
}

export const SIDEBAR_GROUPS: SidebarGroupDefinition[] = [
	{
		id: 'agents',
		label: 'Agents',
		matches: (tab) =>
			tab.kind === 'block' &&
			(tab.block.type === 'command'
				? getCommandSurfaceDefinition(tab.block.presetId).sidebarGroup === 'agents'
				: getPrimitiveDefinition(tab.block.type as Exclude<typeof tab.block.type, 'pending'>)
						.sidebarGroup === 'agents'),
	},
	{
		id: 'browsers',
		label: 'Browsers',
		matches: (tab) =>
			tab.kind === 'block' &&
			(tab.block.type === 'command'
				? getCommandSurfaceDefinition(tab.block.presetId).sidebarGroup === 'browsers'
				: getPrimitiveDefinition(tab.block.type as Exclude<typeof tab.block.type, 'pending'>)
						.sidebarGroup === 'browsers'),
	},
	{
		id: 'terminal',
		label: 'Terminal',
		matches: (tab) =>
			tab.kind === 'block' &&
			(tab.block.type === 'command'
				? getCommandSurfaceDefinition(tab.block.presetId).sidebarGroup === 'terminal'
				: getPrimitiveDefinition(tab.block.type as Exclude<typeof tab.block.type, 'pending'>)
						.sidebarGroup === 'terminal'),
	},
	{
		id: 'commands',
		label: 'Commands',
		matches: (tab) =>
			tab.kind === 'block' &&
			(tab.block.type === 'command'
				? getCommandSurfaceDefinition(tab.block.presetId).sidebarGroup === 'commands'
				: getPrimitiveDefinition(tab.block.type as Exclude<typeof tab.block.type, 'pending'>)
						.sidebarGroup === 'commands'),
	},
	{
		id: 'canvas',
		label: 'Canvas',
		matches: (tab) => tab.kind === 'canvas',
	},
	{
		id: 'drafts',
		label: 'Drafts',
		matches: (tab) => tab.kind === 'pending',
	},
];

export function getSidebarGroupedTabs(orderedTabs: WorkspaceTabState[]) {
	return SIDEBAR_GROUPS.map((group) => ({
		...group,
		tabs: orderedTabs.filter((tab) => group.matches(tab)),
	})).filter((group) => group.tabs.length > 0);
}

export function getSidebarOrderedTabs(orderedTabs: WorkspaceTabState[]) {
	return getSidebarGroupedTabs(orderedTabs).flatMap((group) => group.tabs);
}
