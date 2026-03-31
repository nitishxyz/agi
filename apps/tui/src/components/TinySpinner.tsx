import { memo } from 'react';

interface TinySpinnerProps {
	fg: string;
}

export const TinySpinner = memo(function TinySpinner({ fg }: TinySpinnerProps) {
	return <spinner name="dots" color={fg} />;
});
