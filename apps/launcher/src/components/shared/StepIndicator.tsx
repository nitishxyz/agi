interface Props {
	steps: string[];
	current: number;
}

export function StepIndicator({ steps, current }: Props) {
	return (
		<div className="flex gap-1 mb-2">
			{steps.map((s, i) => (
				<div
					key={s}
					className={`h-1 flex-1 rounded-full ${i <= current ? 'bg-primary' : 'bg-muted'}`}
				/>
			))}
		</div>
	);
}
