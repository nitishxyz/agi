import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PanelWidthState {
	widths: Record<string, number>;
	setWidth: (key: string, width: number) => void;
	getWidth: (key: string, defaultWidth: number) => number;
}

export const usePanelWidthStore = create<PanelWidthState>()(
	persist(
		(set, get) => ({
			widths: {},
			setWidth: (key, width) =>
				set((state) => ({
					widths: { ...state.widths, [key]: width },
				})),
			getWidth: (key, defaultWidth) => get().widths[key] ?? defaultWidth,
		}),
		{
			name: 'panel-widths',
		},
	),
);
