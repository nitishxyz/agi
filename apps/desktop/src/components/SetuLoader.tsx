import { SetuLogo } from './Icons';

export function SetuLoader({ label }: { label?: string }) {
	return (
		<div className="flex flex-col items-center justify-center gap-5">
			<div className="setu-loader-ring">
				<SetuLogo size={32} />
			</div>
			{label && (
				<span className="text-xs text-muted-foreground tracking-wide">
					{label}
				</span>
			)}
		</div>
	);
}
