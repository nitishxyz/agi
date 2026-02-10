interface Props {
	icon: React.ReactNode;
	label: string;
	destructive?: boolean;
	onClick: () => void;
}

export function MenuItem({ icon, label, destructive, onClick }: Props) {
	return (
		<button
			onClick={onClick}
			className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-colors ${destructive ? 'text-destructive' : ''}`}
		>
			{icon}
			{label}
		</button>
	);
}
