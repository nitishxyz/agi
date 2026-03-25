import {
	HeroSection,
	CanvasSection,
	InterfacesSection,
	EmbeddingSection,
	AgentsSection,
	ProvidersSection,
	ToolsSection,
	ArchitectureSection,
	StackSection,
	DesktopSection,
	LauncherSection,
	ShareSection,
	InstallSection,
} from './sections';

export function Landing() {
	return (
		<main className="overflow-hidden">
			<HeroSection />
			<CanvasSection />
			<InterfacesSection />
			<EmbeddingSection />
			<AgentsSection />
			<ProvidersSection />
			<ToolsSection />
			<ArchitectureSection />
			<StackSection />
			<DesktopSection />
			<LauncherSection />
			<ShareSection />
			<InstallSection />
		</main>
	);
}
