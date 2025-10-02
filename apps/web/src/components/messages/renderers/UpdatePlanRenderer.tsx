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
			<div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 space-y-2">
				{note && (
					<div className="text-blue-400 text-sm font-medium mb-3">{note}</div>
				)}
				<div className="space-y-1.5">
					{items.map((item, idx) => (
						<div key={`${item.step}-${idx}`} className="flex items-start gap-2">
							{item.status === 'completed' && (
								<CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
							)}
							{item.status === 'in_progress' && (
								<Loader2 className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5 animate-spin" />
							)}
							{item.status === 'pending' && (
								<Circle className="h-4 w-4 text-zinc-600 flex-shrink-0 mt-0.5" />
							)}
							<span
								className={`text-sm ${
									item.status === 'completed'
										? 'text-zinc-400 line-through'
										: item.status === 'in_progress'
											? 'text-zinc-200'
											: 'text-zinc-500'
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
