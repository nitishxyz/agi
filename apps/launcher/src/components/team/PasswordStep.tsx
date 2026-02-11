import { FormField } from '../shared';

interface Props {
	password: string;
	passwordConfirm: string;
	error: string;
	loading: boolean;
	onPasswordChange: (v: string) => void;
	onConfirmChange: (v: string) => void;
	onSubmit: () => void;
	submitLabel?: string;
}

export function PasswordStep({
	password,
	passwordConfirm,
	error,
	loading,
	onPasswordChange,
	onConfirmChange,
	onSubmit,
	submitLabel = 'Create Team',
}: Props) {
	return (
		<div className="space-y-3">
			<div className="text-sm font-medium">Set Team Password</div>
			<div className="text-xs text-muted-foreground">
				This encrypts the deploy key. Your team members will need this password
				when importing projects.
			</div>

			<FormField
				label="Password"
				value={password}
				onChange={onPasswordChange}
				placeholder="Team password"
				type="password"
				autoFocus
			/>
			<FormField
				label="Confirm"
				value={passwordConfirm}
				onChange={onConfirmChange}
				placeholder="Confirm password"
				type="password"
				onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
			/>

			{error && <div className="text-xs text-destructive">{error}</div>}

			<button
				type="button"
				onClick={onSubmit}
				disabled={loading || !password}
				className="w-full py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
			>
				{loading ? 'Encrypting...' : submitLabel}
			</button>
		</div>
	);
}
