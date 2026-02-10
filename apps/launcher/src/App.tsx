import { useState, useEffect, useCallback } from 'react';
import { tauri, openUrl, type TeamState, type ProjectState, type LauncherState } from './lib/tauri';
import { Welcome } from './components/Welcome';
import { TeamSetup } from './components/TeamSetup';
import { ProjectList } from './components/ProjectList';
import { AddProject } from './components/AddProject';
import { ImportDialog } from './components/ImportDialog';
import { PasswordPrompt } from './components/PasswordPrompt';
import { SetupProgress } from './components/SetupProgress';
import { handleTitleBarDrag } from './utils/title-bar';

type View = 'loading' | 'welcome' | 'team-setup' | 'projects' | 'add-project' | 'import' | 'password-prompt' | 'setup';

function App() {
	const [view, setView] = useState<View>('loading');
	const [team, setTeam] = useState<TeamState | null>(null);
	const [projects, setProjects] = useState<ProjectState[]>([]);
	const [dockerOk, setDockerOk] = useState(true);
	const [setupProject, setSetupProject] = useState<ProjectState | null>(null);
	const [setupPassword, setSetupPassword] = useState('');

	const saveAndUpdate = useCallback(async (t: TeamState | null, p: ProjectState[]) => {
		const state: LauncherState = { team: t, projects: p };
		await tauri.saveState(state);
		setTeam(t);
		setProjects(p);
	}, []);

	const refreshStatuses = useCallback(async (projectList: ProjectState[]) => {
		for (const project of projectList) {
			const running = await tauri.containerRunning(project.containerName);
			project.status = running ? 'running' : 'stopped';
		}
		setProjects([...projectList]);
	}, []);

	useEffect(() => {
		const init = async () => {
			const available = await tauri.dockerAvailable();
			setDockerOk(available);

			try {
				const state = await tauri.loadState();
				setTeam(state.team ?? null);
				setProjects(state.projects);

				if (state.projects.length > 0) {
					await refreshStatuses(state.projects);
				}
			} catch {
				// fresh state
			}
			setView('welcome');
		};
		init();
	}, [refreshStatuses]);

	const handleTeamCreated = async (newTeam: TeamState) => {
		await saveAndUpdate(newTeam, projects);
		setView('welcome');
	};

	const handleAddProject = async (project: ProjectState) => {
		const updated = [...projects, project];
		await saveAndUpdate(team, updated);
		setView('projects');
	};

	const handleImport = async (project: ProjectState, password: string) => {
		const updated = [...projects, project];
		await saveAndUpdate(team, updated);
		setSetupProject(project);
		setSetupPassword(password);
		setView('setup');
	};

	const handleSetupDone = async () => {
		await refreshStatuses(projects);
		setSetupProject(null);
		setSetupPassword('');
		setView('projects');
	};

	const handlePasswordSubmit = (password: string) => {
		setSetupPassword(password);
		setView('setup');
	};

	const handleAction = async (projectId: string, action: string) => {
		const project = projects.find((p) => p.id === projectId);
		if (!project || !team) return;

		switch (action) {
			case 'start': {
				setSetupProject(project);
				const exists = await tauri.containerExists(project.containerName);
				if (exists) {
					setSetupPassword('');
					setView('setup');
				} else {
					setView('password-prompt');
				}
				return;
			}
			case 'stop':
				await tauri.containerStop(project.containerName);
				break;
			case 'restart':
				await tauri.containerRestartOtto(
					project.containerName,
					`/workspace/${project.repo.split('/').pop()?.replace('.git', '')}`,
					project.apiPort,
				);
				break;
			case 'update':
				await tauri.containerUpdateOtto(project.containerName);
				break;
			case 'open':
				openUrl(`http://localhost:${project.webPort}`);
				break;
			case 'nuke': {
				await tauri.containerRemove(project.containerName);
				const remaining = projects.filter((p) => p.id !== projectId);
				await saveAndUpdate(team, remaining);
				return;
			}
			case 'export': {
				const config = {
					version: 1,
					repo: project.repo,
					key: team.encryptedKey,
					cipher: 'aes-256-cbc-pbkdf2',
					gitName: team.gitName,
					gitEmail: team.gitEmail,
					image: project.image || 'oven/bun:1-debian',
					devPorts: project.devPorts || 'auto',
					postClone: project.postClone || 'bun install',
				};
				const name = project.repo.split('/').pop()?.replace('.git', '') || 'project';
				await tauri.saveOttoFile(config, `${name}.otto`);
				return;
			}
		}
		await refreshStatuses(projects);
	};

	if (view === 'loading') {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="text-muted-foreground text-sm">Loading...</div>
			</div>
		);
	}

	const setupRepoName = setupProject?.repo.split('/').pop()?.replace('.git', '') || '';

	return (
		<div className="min-h-screen bg-background text-foreground">
			<div
				className="h-10 flex items-center px-4 select-none cursor-default"
				onMouseDown={handleTitleBarDrag}
				data-tauri-drag-region
			>
				<span className="text-xs font-semibold tracking-wider text-muted-foreground ml-16">
					otto launcher
				</span>
			</div>

			{!dockerOk && (
				<div className="mx-4 mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm">
					Docker Engine is not running. Open Docker Desktop and make
					sure the engine is started (whale icon should be steady, not
					animating).
				</div>
			)}

			{view === 'welcome' && (
				<Welcome
					team={team}
					projects={projects}
					onCreateTeam={() => setView('team-setup')}
					onImport={() => setView('import')}
					onViewTeam={() => setView('projects')}
				/>
			)}

			{view === 'team-setup' && (
				<TeamSetup
					onDone={handleTeamCreated}
					onCancel={() => setView('welcome')}
				/>
			)}

			{view === 'projects' && team && (
				<ProjectList
					team={team}
					projects={projects}
					onAdd={() => setView('add-project')}
					onImport={() => setView('import')}
					onAction={handleAction}
					onBack={() => setView('welcome')}
				/>
			)}

			{view === 'add-project' && team && (
				<AddProject
					team={team}
					existingProjects={projects}
					onAdd={handleAddProject}
					onCancel={() => setView('projects')}
				/>
			)}

			{view === 'import' && (
				<ImportDialog
					existingProjects={projects}
					onImport={handleImport}
					onCancel={() => setView('welcome')}
				/>
			)}

			{view === 'password-prompt' && setupProject && (
				<PasswordPrompt
					repoName={setupRepoName}
					onSubmit={handlePasswordSubmit}
					onCancel={() => { setSetupProject(null); setView('projects'); }}
				/>
			)}

			{view === 'setup' && setupProject && team && (
				<SetupProgress
					project={setupProject}
					password={setupPassword}
					encryptedKey={team.encryptedKey}
					onDone={handleSetupDone}
					onBack={() => { setSetupProject(null); setSetupPassword(''); setView('projects'); }}
				/>
			)}
		</div>
	);
}

export default App;
