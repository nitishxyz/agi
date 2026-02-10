import { useState, useEffect, useRef } from 'react';
import { tauri, openUrl, type ProjectState } from '../lib/tauri';
import { Check, Circle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { BackButton } from './shared';

interface Props {
	project: ProjectState;
	password: string;
	encryptedKey: string;
	onDone: () => void;
	onBack: () => void;
}

const STEPS = [
	'Installing system packages',
	'Setting up SSH',
	'Configuring git',
	'Cloning repo',
	'Installing dependencies',
	'Starting otto',
];

export function SetupProgress({ project, password, encryptedKey, onDone, onBack }: Props) {
	const [currentStep, setCurrentStep] = useState(0);
	const [logs, setLogs] = useState('');
	const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
	const [error, setError] = useState('');
	const [done, setDone] = useState(false);
	const [consoleOpen, setConsoleOpen] = useState(true);
	const [hovered, setHovered] = useState(false);
	const pollRef = useRef<ReturnType<typeof setInterval>>();
	const consoleRef = useRef<HTMLPreElement>(null);
	const startedRef = useRef(false);
	const repoName = project.repo.split('/').pop()?.replace('.git', '') || 'project';
	const isPersonal = project.sshMode === 'personal';

	const log = (msg: string) => {
		setConsoleLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
	};

	useEffect(() => {
		if (!hovered && consoleRef.current) {
			consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
		}
	}, [consoleLogs, logs, hovered]);

	useEffect(() => {
		if (startedRef.current) return;
		startedRef.current = true;

		const run = async () => {
			log(`Starting setup for ${repoName}...`);
			log(`Container: ${project.containerName}`);
			log(`Ports: API=${project.apiPort} Web=${project.webPort}`);
			log(`SSH mode: ${isPersonal ? 'personal (~/.ssh mounted)' : 'team deploy key'}`);

			try {
				const exists = await tauri.containerExists(project.containerName);
				if (exists) {
					log('Container exists, starting...');
					await tauri.containerStart(project.containerName);
					log('Container started');
				} else {
					log('Creating new container...');
					log(`Image: ${project.image || 'oven/bun:1-debian'}`);
					log(`Repo: ${project.repo}`);
					const id = await tauri.containerCreate({
						name: project.containerName,
						repoUrl: project.repo,
						repoDir: `/workspace/${repoName}`,
						encryptedKey: isPersonal ? '' : encryptedKey,
						password: isPersonal ? '' : password,
						gitName: project.gitName || 'Team',
						gitEmail: project.gitEmail || 'team@otto.dev',
						apiPort: project.apiPort,
						devPortStart: project.apiPort + 10,
						devPortEnd: project.apiPort + 19,
						image: project.image || 'oven/bun:1-debian',
						usePersonalSsh: isPersonal,
					sshKeyName: project.sshKeyName || '',
				sshPassphrase: project.sshPassphrase || '',
					});
					log(`Container created: ${id.slice(0, 12)}`);
				}

				log('Polling container logs...');
				pollRef.current = setInterval(async () => {
					try {
						const logText = await tauri.containerLogs(project.containerName, 50);
						setLogs(logText);

					const running = await tauri.containerRunning(project.containerName);
					if (!running) {
						const failMsg = logText.includes('Permission denied')
							? 'SSH authentication failed — key may be passphrase-protected'
							: logText.includes('fatal:')
								? 'Git clone failed — check SSH key and repo access'
								: 'Container exited unexpectedly';
						setError(failMsg);
						log(`FATAL: ${failMsg}`);
						if (pollRef.current) clearInterval(pollRef.current);
						return;
					}

					for (let i = STEPS.length - 1; i >= 0; i--) {
						const stepTag = `[${i + 1}/6]`;
						const idx = logText.lastIndexOf(stepTag);
						if (idx !== -1) {
							const afterTag = logText.slice(idx, idx + 50);
							if (afterTag.includes('Done') || afterTag.includes('Starting')) {
								setCurrentStep(Math.min(i + 1, STEPS.length - 1));
							} else {
								setCurrentStep(i);
							}
							break;
							}
						}

						if (logText.includes('Otto is ready!') || logText.includes('otto serve')) {
							setDone(true);
							setError('');
							log('Otto is ready!');
							if (pollRef.current) clearInterval(pollRef.current);
						}
					} catch (err) {
						log(`Log poll: ${err instanceof Error ? err.message : err}`);
					}
				}, 2000);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				setError(msg);
				log(`FATAL: ${msg}`);
			}
		};
		run();

		return () => {
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, [project, password, encryptedKey, repoName, isPersonal]);

	const status = error ? 'error' : done ? 'done' : 'running';

	return (
		<div className="flex flex-col h-[calc(100vh-2.5rem)]">
			<div className="flex-1 overflow-auto px-4 pb-4 space-y-4">
				<BackButton onClick={onBack} />
				<div className="text-sm font-medium">Setting up {repoName}...</div>

				<div className="space-y-2">
					{STEPS.map((step, i) => (
						<div key={step} className="flex items-center gap-2">
							{i < currentStep ? (
								<Check size={14} className="text-green-500" />
							) : i === currentStep && status === 'running' ? (
								<Loader2 size={14} className="text-muted-foreground animate-spin" />
							) : done && i <= currentStep ? (
								<Check size={14} className="text-green-500" />
							) : (
								<Circle size={14} className="text-muted-foreground/30" />
							)}
							<span
								className={`text-xs ${
									i <= currentStep ? 'text-foreground' : 'text-muted-foreground/50'
								}`}
							>
								{step}
							</span>
						</div>
					))}
				</div>

				{error && !done && (
					<div className="text-xs text-destructive p-2 rounded bg-destructive/10 border border-destructive/20">
						{error}
					</div>
				)}

				{done && (
					<div className="space-y-2">
						<div className="text-xs text-green-500">
							Otto is ready at http://localhost:{project.webPort}
						</div>
						<div className="flex gap-2">
							<button
								onClick={() => openUrl(`http://localhost:${project.webPort}`)}
								className="flex-1 py-2 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
							>
								Open Web UI
							</button>
							<button
								onClick={onDone}
								className="flex-1 py-2 text-xs rounded-md bg-secondary hover:bg-accent transition-colors"
							>
								Back to Projects
							</button>
						</div>
					</div>
				)}
			</div>

			<div className="border-t border-border">
				<button
					onClick={() => setConsoleOpen(!consoleOpen)}
					className="w-full flex items-center justify-between px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
				>
					<span className="font-mono">Console</span>
					<div className="flex items-center gap-2">
						<span className={
							status === 'error' ? 'text-destructive'
								: status === 'done' ? 'text-green-500'
									: 'text-yellow-500'
						}>{status}</span>
						{consoleOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
					</div>
				</button>
				{consoleOpen && (
					<pre
						ref={consoleRef}
						onMouseEnter={() => setHovered(true)}
						onMouseLeave={() => setHovered(false)}
						className="px-4 pb-3 text-[10px] leading-4 font-mono text-muted-foreground overflow-auto max-h-36 whitespace-pre-wrap"
					>
						{consoleLogs.map((line, i) => (
							<div
								key={i}
								className={
									line.includes('FATAL:') || line.includes('ERROR:')
										? 'text-destructive'
										: line.includes('ready')
											? 'text-green-500'
											: ''
								}
							>
								{line}
							</div>
						))}
						{logs && (
							<>
								<div className="border-t border-border/30 my-1" />
								<div className="text-muted-foreground/60">--- container logs ---</div>
								{logs}
							</>
						)}
					</pre>
				)}
			</div>
		</div>
	);
}
