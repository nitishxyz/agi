import { useState, useEffect } from 'react';
import { tauriBridge, type Project } from './lib/tauri-bridge';
import { tauriOnboarding } from './lib/tauri-onboarding';
import { ProjectPicker } from './components/ProjectPicker';
import { Workspace } from './components/Workspace';
import { NativeOnboarding } from './components/onboarding/NativeOnboarding';
import { SetuLoader } from './components/SetuLoader';
import './index.css';

type View = 'loading' | 'onboarding' | 'picker' | 'workspace';

function App() {
	const [view, setView] = useState<View>('loading');
	const [selectedProject, setSelectedProject] = useState<Project | null>(null);

	useEffect(() => {
		document.documentElement.classList.add('dark');

		const init = async () => {
			const initialPath = await tauriBridge.getInitialProject();

			try {
				const status = await tauriOnboarding.getStatus();

				if (!status.onboardingComplete) {
					setView('onboarding');
					return;
				}
			} catch {
				setView('onboarding');
				return;
			}

			if (initialPath) {
				const name = initialPath.split('/').pop() || initialPath;
				const project: Project = {
					path: initialPath,
					name,
					lastOpened: new Date().toISOString(),
					pinned: false,
				};
				tauriBridge.saveRecentProject(project).catch(() => {});
				setSelectedProject(project);
				setView('workspace');
			} else {
				setView('picker');
			}
		};

		init();
	}, []);

	const handleSelectProject = (project: Project) => {
		setSelectedProject(project);
		setView('workspace');
	};

	const handleBack = () => {
		setView('picker');
		setSelectedProject(null);
	};

	const handleOnboardingComplete = () => {
		setView('picker');
	};

	if (view === 'loading') {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<SetuLoader />
			</div>
		);
	}

	return (
		<>
			{view === 'onboarding' && (
				<NativeOnboarding onComplete={handleOnboardingComplete} />
			)}
			{view === 'picker' && (
				<ProjectPicker onSelectProject={handleSelectProject} />
			)}
			{view === 'workspace' && selectedProject && (
				<Workspace
					key={selectedProject.path}
					project={selectedProject}
					onBack={handleBack}
				/>
			)}
		</>
	);
}

export default App;
