import { memo, useMemo } from 'react';
import {
	ChevronRight,
	Sparkles,
	Loader2,
	FolderDot,
	Laptop,
	Globe,
	FileText,
	FileCode,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useSkillsStore } from '../../stores/skillsStore';
import {
	useSkills,
	useSkillDetail,
	useSkillFiles,
} from '../../hooks/useSkills';

const SCOPE_ICONS: Record<string, typeof FolderDot> = {
	cwd: FolderDot,
	parent: FolderDot,
	repo: FolderDot,
	user: Laptop,
	system: Globe,
};

const SCOPE_LABELS: Record<string, string> = {
	cwd: 'Project',
	parent: 'Parent',
	repo: 'Repository',
	user: 'User',
	system: 'System',
};

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const SkillsSidebar = memo(function SkillsSidebar() {
	const isExpanded = useSkillsStore((s) => s.isExpanded);
	const collapseSidebar = useSkillsStore((s) => s.collapseSidebar);
	const skills = useSkillsStore((s) => s.skills);
	const selectedSkill = useSkillsStore((s) => s.selectedSkill);
	const selectSkill = useSkillsStore((s) => s.selectSkill);
	const openViewer = useSkillsStore((s) => s.openViewer);
	const viewingFile = useSkillsStore((s) => s.viewingFile);

	const { isLoading } = useSkills();
	const { data: skillDetail } = useSkillDetail(selectedSkill);
	const { data: skillFilesData } = useSkillFiles(selectedSkill);
	const skillFiles = skillFilesData?.files ?? [];

	const groupedSkills = useMemo(() => {
		const groups = new Map<string, typeof skills>();
		for (const skill of skills) {
			const list = groups.get(skill.scope) ?? [];
			list.push(skill);
			groups.set(skill.scope, list);
		}
		return groups;
	}, [skills]);

	if (!isExpanded) return null;

	return (
		<div className="w-80 border-l border-border bg-background flex flex-col h-full">
			<div className="h-14 flex items-center justify-between px-3 border-b border-border">
				<div className="flex items-center gap-2">
					<Sparkles className="w-4 h-4 text-muted-foreground" />
					<span className="font-medium text-sm">Skills</span>
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={collapseSidebar}
					title="Close sidebar"
				>
					<ChevronRight className="w-4 h-4" />
				</Button>
			</div>

			{selectedSkill && skillDetail ? (
				<div className="flex-1 overflow-y-auto">
					<div className="p-3 border-b border-border">
						<button
							type="button"
							onClick={() => selectSkill(null)}
							className="text-xs text-muted-foreground hover:text-foreground transition-colors"
						>
							← Back to list
						</button>
					</div>
					<div className="px-3 py-3 border-b border-border">
						<h3 className="font-medium text-sm mb-1">{skillDetail.name}</h3>
						<p className="text-xs text-muted-foreground mb-2">
							{skillDetail.description}
						</p>
						<div className="flex items-center gap-2">
							<span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
								{SCOPE_LABELS[skillDetail.scope] ?? skillDetail.scope}
							</span>
							{skillDetail.license && (
								<span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
									{skillDetail.license}
								</span>
							)}
						</div>
					</div>

					<div className="py-1">
						<div className="flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
							Files
						</div>
						<button
							type="button"
							onClick={() => openViewer(null)}
							className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors ${
								viewingFile === null ? 'bg-accent' : ''
							}`}
						>
							<div className="flex items-center gap-2">
								<FileText className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
								<span className="text-sm font-mono truncate flex-1">
									SKILL.md
								</span>
							</div>
						</button>
						{skillFiles.map((file) => (
							<button
								type="button"
								key={file.relativePath}
								onClick={() => openViewer(file.relativePath)}
								className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors ${
									viewingFile === file.relativePath ? 'bg-accent' : ''
								}`}
							>
								<div className="flex items-center gap-2">
									<FileCode className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
									<span className="text-sm font-mono truncate flex-1">
										{file.relativePath}
									</span>
									<span className="text-[10px] text-muted-foreground flex-shrink-0">
										{formatSize(file.size)}
									</span>
								</div>
							</button>
						))}
					</div>
				</div>
			) : (
				<div className="flex-1 overflow-y-auto">
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
						</div>
					) : skills.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-full text-center p-4">
							<Sparkles className="w-12 h-12 text-muted-foreground/30 mb-4" />
							<h3 className="text-sm font-medium mb-2">No skills found</h3>
							<p className="text-xs text-muted-foreground max-w-[220px]">
								Create skills in{' '}
								<code className="text-[10px] bg-muted px-1 rounded">
									.otto/skills/
								</code>{' '}
								or{' '}
								<code className="text-[10px] bg-muted px-1 rounded">
									~/.config/otto/skills/
								</code>
							</p>
						</div>
					) : (
						<div className="py-1">
							{['cwd', 'parent', 'repo', 'user', 'system'].map((scope) => {
								const scopeSkills = groupedSkills.get(scope);
								if (!scopeSkills?.length) return null;
								const ScopeIcon = SCOPE_ICONS[scope] ?? Globe;
								return (
									<div key={scope}>
										<div className="flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
											<ScopeIcon className="w-3 h-3" />
											{SCOPE_LABELS[scope] ?? scope}
										</div>
										{scopeSkills.map((skill) => (
											<button
												type="button"
												key={`${skill.scope}-${skill.name}`}
												onClick={() => selectSkill(skill.name)}
												className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors ${
													selectedSkill === skill.name ? 'bg-accent' : ''
												}`}
											>
												<div className="flex items-center gap-2">
													<FileText className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
													<div className="min-w-0 flex-1">
														<div className="text-sm font-medium truncate">
															{skill.name}
														</div>
														<div className="text-xs text-muted-foreground truncate">
															{skill.description}
														</div>
													</div>
												</div>
											</button>
										))}
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}
		</div>
	);
});
