import { useRef, type ReactNode } from 'react';
import { CopyMarkdownButton } from './CopyMarkdownButton';

export function DocPage({ children }: { children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null);
	return (
		<div>
			<div className="flex justify-end mb-4">
				<CopyMarkdownButton contentRef={ref} />
			</div>
			<div ref={ref}>{children}</div>
		</div>
	);
}
