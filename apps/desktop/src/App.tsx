import { useState, useEffect } from 'react';
import { tauriBridge, type Project } from './lib/tauri-bridge';
import { ProjectPicker } from './components/ProjectPicker';
import { Workspace } from './components/Workspace';
import './index.css';

type View = 'picker' | 'workspace';

function App() {
	const [view, setView] = useState<View>('picker');
	const [selectedProject, setSelectedProject] = useState<Project | null>(null);

	useEffect(() => {
		document.documentElement.classList.add('dark');
		tauriBridge.getInitialProject().then((path) => {
			if (path) {
				const name = path.split('/').pop() || path;
				const project: Project = {
					path,
					name,
					lastOpened: new Date().toISOString(),
					pinned: false,
				};
				tauriBridge.saveRecentProject(project).catch(() => {});
				setSelectedProject(project);
				setView('workspace');
			}
		});
	}, []);

	const handleSelectProject = (project: Project) => {
		setSelectedProject(project);
		setView('workspace');
	};

	const handleBack = () => {
		setView('picker');
		setSelectedProject(null);
	};

	return (
		<>
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
