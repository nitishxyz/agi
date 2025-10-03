import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import type { RendererProps } from './types';

interface PlanItem {
	step: string;
	status: 'pending' | 'in_progress' | 'completed';
}

interface UpdatePlanResult {
	items?: PlanItem[];
	note?: string;
}

export function UpdatePlanRenderer({ contentJson }: RendererProps) {
	const result = (contentJson.result || {}) as UpdatePlanResult;
	const items = result.items || [];
	const note = result.note;

	return (
		<div className="text-xs">
			<div className="bg-blue-500/10 border border-blue-500/30 dark:bg-blue-500/5 dark:border-blue-500/20 rounded-lg p-3 space-y-2">
				{note && (
					<div className="text-blue-700 dark:text-blue-300 text-sm font-medium mb-3">{note}</div>
				)}
				<div className="space-y-1.5">
					{items.map((item, idx) => (
						<div key={`${item.step}-${idx}`} className="flex items-start gap-2">
							{item.status === 'completed' && (
								<CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300 flex-shrink-0 mt-0.5" />
							)}
							{item.status === 'in_progress' && (
								<Loader2 className="h-4 w-4 text-blue-700 dark:text-blue-300 flex-shrink-0 mt-0.5 animate-spin" />
							)}
						{item.status === 'pending' && (
							<Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
						)}
							<span
								className={`text-sm ${
									item.status === 'completed'
										? 'text-muted-foreground line-through'
										: item.status === 'in_progress'
											? 'text-foreground'
											: 'text-muted-foreground/80'
								}`}
							>
								{item.step}
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
