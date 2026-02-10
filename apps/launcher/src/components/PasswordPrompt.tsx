import { useState } from 'react';
import { BackButton, FormField } from './shared';

interface Props {
	repoName: string;
	onSubmit: (password: string) => void;
	onCancel: () => void;
}

export function PasswordPrompt({ repoName, onSubmit, onCancel }: Props) {
	const [password, setPassword] = useState('');
	const [error, setError] = useState('');

	const handleSubmit = () => {
		if (!password) {
			setError('Password is required');
			return;
		}
		onSubmit(password);
	};

	return (
		<div className="px-4 pb-4 space-y-4">
			<BackButton onClick={onCancel} />

			<div className="space-y-3">
				<div className="text-sm font-medium">Start {repoName}</div>
				<div className="text-xs text-muted-foreground">
					Enter the team password to decrypt the deploy key
					and set up the container.
				</div>

				<FormField
					label="Team password"
					value={password}
					onChange={setPassword}
					placeholder="Enter team password"
					type="password"
					autoFocus
					onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
				/>

				{error && <div className="text-xs text-destructive">{error}</div>}

				<button
					onClick={handleSubmit}
					disabled={!password}
					className="w-full py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
				>
					Start Setup
				</button>
			</div>
		</div>
	);
}
