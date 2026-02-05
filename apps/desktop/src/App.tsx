import { useState, useEffect, createContext, useContext } from 'react';
import { tauriBridge, type Project } from './lib/tauri-bridge';
import { tauriOnboarding } from './lib/tauri-onboarding';
import { ProjectPicker } from './components/ProjectPicker';
import { Workspace } from './components/Workspace';
import { NativeOnboarding } from './components/onboarding/NativeOnboarding';
import { SetuLoader } from './components/SetuLoader';
import { useTheme } from '@ottocode/web-sdk/hooks';
import type { Theme } from '@ottocode/web-sdk/hooks';
import './index.css';

type View = 'loading' | 'onboarding' | 'picker' | 'workspace';

interface ThemeContextValue {
	theme: Theme;
	setTheme: (theme: Theme) => void;
	toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
	theme: 'dark',
	setTheme: () => {},
	toggleTheme: () => {},
});

export const useDesktopTheme = () => useContext(ThemeContext);

function App() {
	const [view, setView] = useState<View>('loading');
	const [selectedProject, setSelectedProject] = useState<Project | null>(null);
	const { theme, setTheme, toggleTheme } = useTheme();

	useEffect(() => {
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
		const updatedProject = {
			...project,
			lastOpened: new Date().toISOString(),
		};
		tauriBridge.saveRecentProject(updatedProject).catch(() => {});
		setSelectedProject(updatedProject);
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
		<ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
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
		</ThemeContext.Provider>
	);
}

export default App;
