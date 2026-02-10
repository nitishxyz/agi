import { useState } from 'react';
import { tauri, type TeamState } from '../lib/tauri';
import { StepIndicator, BackButton } from './shared';
import { TeamInfoStep } from './team/TeamInfoStep';
import { DeployKeyStep } from './team/DeployKeyStep';
import { PasswordStep } from './team/PasswordStep';

interface Props {
	onDone: (team: TeamState) => void;
	onCancel: () => void;
}

type Step = 'info' | 'key' | 'password';
const STEPS = ['info', 'key', 'password'];

export function TeamSetup({ onDone, onCancel }: Props) {
	const [step, setStep] = useState<Step>('info');
	const [teamName, setTeamName] = useState('');
	const [gitName, setGitName] = useState('');
	const [gitEmail, setGitEmail] = useState('');
	const [publicKey, setPublicKey] = useState('');
	const [privateKey, setPrivateKey] = useState('');
	const [password, setPassword] = useState('');
	const [passwordConfirm, setPasswordConfirm] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const handleGenerateKey = async () => {
		if (!teamName || !gitName || !gitEmail) {
			setError('All fields are required');
			return;
		}
		setLoading(true);
		setError('');
		try {
			const keyPair = await tauri.generateDeployKey();
			setPublicKey(keyPair.publicKey);
			setPrivateKey(keyPair.encryptedPrivateKey);
			setStep('key');
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Key generation failed');
		}
		setLoading(false);
	};

	const handleEncrypt = async () => {
		if (!password) { setError('Password is required'); return; }
		if (password !== passwordConfirm) { setError('Passwords do not match'); return; }
		if (password.length < 4) { setError('Password too short (min 4 chars)'); return; }
		setLoading(true);
		setError('');
		try {
			const encryptedKey = await tauri.encryptKey(privateKey, password);
			onDone({ name: teamName, publicKey, encryptedKey, gitName, gitEmail });
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Encryption failed');
		}
		setLoading(false);
	};

	return (
		<div className="px-4 pb-4 space-y-4">
			<BackButton onClick={onCancel} />
			<StepIndicator steps={STEPS} current={STEPS.indexOf(step)} />

			{step === 'info' && (
				<TeamInfoStep
					teamName={teamName}
					gitName={gitName}
					gitEmail={gitEmail}
					error={error}
					loading={loading}
					onTeamNameChange={setTeamName}
					onGitNameChange={setGitName}
					onGitEmailChange={setGitEmail}
					onSubmit={handleGenerateKey}
				/>
			)}

			{step === 'key' && (
				<DeployKeyStep
					publicKey={publicKey}
					onNext={() => { setError(''); setStep('password'); }}
				/>
			)}

			{step === 'password' && (
				<PasswordStep
					password={password}
					passwordConfirm={passwordConfirm}
					error={error}
					loading={loading}
					onPasswordChange={setPassword}
					onConfirmChange={setPasswordConfirm}
					onSubmit={handleEncrypt}
				/>
			)}
		</div>
	);
}
