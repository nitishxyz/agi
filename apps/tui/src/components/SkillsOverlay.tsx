import { useKeyboard } from '@opentui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	client,
	getSkillsConfig,
	updateSkillsConfig as updateSkillsConfigApi,
} from '@ottocode/api';
import { getBaseUrl } from '../api.ts';
import { useTheme } from '../theme.ts';

type SkillSummary = {
	name: string;
	description: string;
	scope: string;
	path: string;
	enabled?: boolean;
};

type SkillsConfigResponse = {
	enabled: boolean;
	totalCount: number;
	enabledCount: number;
	items: SkillSummary[];
};

interface SkillsOverlayProps {
	onClose: () => void;
}

const SCOPE_ORDER = ['cwd', 'parent', 'repo', 'user', 'system'] as const;
const SCOPE_LABELS: Record<string, string> = {
	cwd: 'PROJECT',
	parent: 'PARENT',
	repo: 'REPOSITORY',
	user: 'USER',
	system: 'SYSTEM',
};

async function fetchSkillsConfig(): Promise<SkillsConfigResponse> {
	client.setConfig({ baseURL: getBaseUrl() });
	const response = await getSkillsConfig();
	if (response.error) {
		throw new Error(
			typeof response.error === 'object' &&
				response.error &&
				'error' in response.error
				? JSON.stringify(response.error)
				: 'Failed to load skills',
		);
	}
	return response.data as SkillsConfigResponse;
}

async function updateSkillsConfig(input: {
	enabled?: boolean;
	items?: Record<string, { enabled?: boolean }>;
	scope?: 'global' | 'local';
}): Promise<SkillsConfigResponse> {
	client.setConfig({ baseURL: getBaseUrl() });
	const response = await updateSkillsConfigApi({ body: input });
	if (response.error) {
		throw new Error(
			typeof response.error === 'object' &&
				response.error &&
				'error' in response.error
				? JSON.stringify(response.error)
				: 'Failed to update skills',
		);
	}
	return response.data as SkillsConfigResponse;
}

export function SkillsOverlay({ onClose }: SkillsOverlayProps) {
	const { colors } = useTheme();
	const [skills, setSkills] = useState<SkillSummary[]>([]);
	const [globalEnabled, setGlobalEnabled] = useState(true);
	const [totalCount, setTotalCount] = useState(0);
	const [enabledCount, setEnabledCount] = useState(0);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [status, setStatus] = useState<string | null>(null);
	const [selectedIdx, setSelectedIdx] = useState(0);

	const selectedIdxRef = useRef(selectedIdx);
	selectedIdxRef.current = selectedIdx;
	const rowsRef = useRef<Array<{ type: 'global' | 'skill'; name?: string }>>(
		[],
	);

	const applyConfig = useCallback((config: SkillsConfigResponse) => {
		setSkills(config.items);
		setGlobalEnabled(config.enabled);
		setTotalCount(config.totalCount);
		setEnabledCount(config.enabledCount);
	}, []);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const config = await fetchSkillsConfig();
			applyConfig(config);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load skills');
		} finally {
			setLoading(false);
		}
	}, [applyConfig]);

	useEffect(() => {
		void load();
	}, [load]);

	const grouped = useMemo(() => {
		const map = new Map<string, SkillSummary[]>();
		for (const skill of skills) {
			const arr = map.get(skill.scope) ?? [];
			arr.push(skill);
			map.set(skill.scope, arr);
		}
		for (const arr of map.values()) {
			arr.sort((a, b) => a.name.localeCompare(b.name));
		}
		return map;
	}, [skills]);

	const rows = useMemo(() => {
		const out: Array<{ type: 'global' | 'skill'; name?: string }> = [
			{ type: 'global' },
		];
		for (const scope of SCOPE_ORDER) {
			const scopeSkills = grouped.get(scope);
			if (!scopeSkills?.length) continue;
			for (const skill of scopeSkills) {
				out.push({ type: 'skill', name: skill.name });
			}
		}
		return out;
	}, [grouped]);
	rowsRef.current = rows;

	useEffect(() => {
		setSelectedIdx((current) =>
			Math.min(current, Math.max(rows.length - 1, 0)),
		);
	}, [rows.length]);

	const mutate = useCallback(
		async (input: {
			enabled?: boolean;
			items?: Record<string, { enabled?: boolean }>;
			scope?: 'global' | 'local';
		}) => {
			setSaving(true);
			setError(null);
			setStatus(null);
			try {
				const config = await updateSkillsConfig(input);
				applyConfig(config);
				setStatus('saved');
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to save skills');
			} finally {
				setSaving(false);
			}
		},
		[applyConfig],
	);

	const toggleSelected = useCallback(() => {
		const row = rowsRef.current[selectedIdxRef.current];
		if (!row || saving) return;
		if (row.type === 'global') {
			void mutate({ enabled: !globalEnabled });
			return;
		}
		const skill = skills.find((entry) => entry.name === row.name);
		if (!skill) return;
		void mutate({
			items: {
				[skill.name]: {
					enabled: skill.enabled === false,
				},
			},
		});
	}, [globalEnabled, mutate, saving, skills]);

	useKeyboard((key) => {
		if (key.name === 'escape') {
			onClose();
			return;
		}
		if (key.name === 'up') {
			setSelectedIdx((current) => Math.max(0, current - 1));
			return;
		}
		if (key.name === 'down') {
			setSelectedIdx((current) =>
				Math.min(rowsRef.current.length - 1, current + 1),
			);
			return;
		}
		if (key.name === 'return' || key.name === 'space') {
			toggleSelected();
			return;
		}
		if (key.name === 'r') {
			void load();
		}
	});

	let absoluteRow = 0;

	return (
		<box
			position="absolute"
			top={3}
			left="20%"
			width="60%"
			height="80%"
			border
			borderColor={colors.border}
			backgroundColor={colors.panel}
			flexDirection="column"
		>
			<box
				height={3}
				paddingX={2}
				borderBottom
				borderColor={colors.border}
				alignItems="center"
				justifyContent="space-between"
			>
				<text fg={colors.text} bold>
					Skills
				</text>
				<text fg={colors.textMuted}>
					{enabledCount}/{totalCount}
				</text>
			</box>

			<box
				flexDirection="column"
				flexGrow={1}
				paddingX={2}
				paddingY={1}
				overflow="hidden"
			>
				{loading ? (
					<box flexGrow={1} alignItems="center" justifyContent="center">
						<text fg={colors.textMuted}>Loading skills…</text>
					</box>
				) : error ? (
					<box
						flexGrow={1}
						alignItems="center"
						justifyContent="center"
						flexDirection="column"
					>
						<text fg={colors.error}>{error}</text>
					</box>
				) : totalCount === 0 ? (
					<box
						flexGrow={1}
						alignItems="center"
						justifyContent="center"
						flexDirection="column"
					>
						<text fg={colors.text}>No skills found</text>
						<text fg={colors.textMuted}>
							Create skills in .otto/skills or ~/.config/otto/skills
						</text>
					</box>
				) : (
					<box flexDirection="column" flexGrow={1}>
						<box
							paddingY={1}
							justifyContent="space-between"
							backgroundColor={selectedIdx === 0 ? colors.selection : undefined}
						>
							<text fg={colors.text}>All skills</text>
							<text fg={globalEnabled ? colors.success : colors.textMuted}>
								{saving && selectedIdx === 0
									? '…'
									: globalEnabled
										? 'ON'
										: 'OFF'}
							</text>
						</box>

						{SCOPE_ORDER.map((scope) => {
							const scopeSkills = grouped.get(scope);
							if (!scopeSkills?.length) return null;
							return (
								<box key={scope} flexDirection="column" marginTop={1}>
									<text fg={colors.textMuted}>
										{SCOPE_LABELS[scope] ?? scope}
									</text>
									{scopeSkills.map((skill) => {
										absoluteRow += 1;
										const isSelected = selectedIdx === absoluteRow;
										return (
											<box
												key={`${skill.scope}-${skill.name}`}
												paddingY={1}
												justifyContent="space-between"
												backgroundColor={
													isSelected ? colors.selection : undefined
												}
											>
												<box flexDirection="column" width="80%">
													<text fg={colors.text}>{skill.name}</text>
													<text fg={colors.textMuted}>{skill.description}</text>
												</box>
												<text
													fg={
														skill.enabled === false
															? colors.textMuted
															: colors.success
													}
												>
													{saving && isSelected
														? '…'
														: skill.enabled === false
															? 'OFF'
															: 'ON'}
												</text>
											</box>
										);
									})}
								</box>
							);
						})}
					</box>
				)}
			</box>

			<box
				height={2}
				paddingX={2}
				borderTop
				borderColor={colors.border}
				alignItems="center"
				justifyContent="space-between"
			>
				<text
					fg={error ? colors.error : status ? colors.success : colors.textMuted}
				>
					{error ?? status ?? '↑↓ nav · space toggle · r refresh · esc close'}
				</text>
			</box>
		</box>
	);
}
