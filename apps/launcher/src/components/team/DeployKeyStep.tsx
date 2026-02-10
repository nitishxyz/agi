import { CopyBlock } from '../shared';

interface Props {
	publicKey: string;
	onNext: () => void;
}

export function DeployKeyStep({ publicKey, onNext }: Props) {
	return (
		<div className="space-y-3">
			<div className="text-sm font-medium">Your Deploy Key</div>
			<div className="text-xs text-muted-foreground">
				Copy this public key. You'll add it to each repo you
				want your team to work on:<br />
				<span className="text-foreground">
					GitHub → Repo → Settings → Deploy Keys → Add
				</span>
				<br />
				Check "Allow write access".
			</div>

			<CopyBlock text={publicKey} />

			<button
				onClick={onNext}
				className="w-full py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
			>
				I've saved the key → Set password
			</button>
		</div>
	);
}
