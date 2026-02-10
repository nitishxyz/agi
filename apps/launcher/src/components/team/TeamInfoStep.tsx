import { FormField } from '../shared';
import { KeyRound } from 'lucide-react';

interface Props {
	teamName: string;
	gitName: string;
	gitEmail: string;
	error: string;
	loading: boolean;
	onTeamNameChange: (v: string) => void;
	onGitNameChange: (v: string) => void;
	onGitEmailChange: (v: string) => void;
	onSubmit: () => void;
}

export function TeamInfoStep({
	teamName,
	gitName,
	gitEmail,
	error,
	loading,
	onTeamNameChange,
	onGitNameChange,
	onGitEmailChange,
	onSubmit,
}: Props) {
	return (
		<div className="space-y-3">
			<div className="text-sm font-medium">Create Your Team</div>
			<div className="text-xs text-muted-foreground">
				Set up your team identity. This generates a deploy key you'll add to
				your repos.
			</div>

			<FormField
				label="Team name"
				value={teamName}
				onChange={onTeamNameChange}
				placeholder="My Team"
				autoFocus
			/>
			<FormField
				label="Git commit name"
				value={gitName}
				onChange={onGitNameChange}
				placeholder="Team Name"
			/>
			<FormField
				label="Git commit email"
				value={gitEmail}
				onChange={onGitEmailChange}
				placeholder="team@company.com"
			/>

			{error && <div className="text-xs text-destructive">{error}</div>}

			<button
				onClick={onSubmit}
				disabled={loading || !teamName}
				className="w-full py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
			>
				<KeyRound size={14} />
				{loading ? 'Generating...' : 'Generate Deploy Key'}
			</button>
		</div>
	);
}
