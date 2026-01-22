import { memo } from 'react';

import anthropicLogo from '../../assets/providers/anthropic.svg?raw';
import openaiLogo from '../../assets/providers/openai.svg?raw';
import googleLogo from '../../assets/providers/google.svg?raw';
import openrouterLogo from '../../assets/providers/openrouter.svg?raw';
import groqLogo from '../../assets/providers/groq.svg?raw';
import deepseekLogo from '../../assets/providers/deepseek.svg?raw';
import xaiLogo from '../../assets/providers/xai.svg?raw';
import zaiLogo from '../../assets/providers/zai.svg?raw';
import solforgeLogo from '../../assets/providers/solforge.svg?raw';
import opencodeLogo from '../../assets/providers/opencode.svg?raw';

const providerLogos: Record<string, string> = {
	anthropic: anthropicLogo,
	openai: openaiLogo,
	google: googleLogo,
	openrouter: openrouterLogo,
	groq: groqLogo,
	deepseek: deepseekLogo,
	xai: xaiLogo,
	zai: zaiLogo,
	'zai-coding': zaiLogo,
	solforge: solforgeLogo,
	opencode: opencodeLogo,
};

interface ProviderLogoProps {
	provider: string;
	className?: string;
	size?: number;
}

export const ProviderLogo = memo(function ProviderLogo({
	provider,
	className = '',
	size = 16,
}: ProviderLogoProps) {
	const logoSvg = providerLogos[provider.toLowerCase()];

	if (!logoSvg) {
		return (
			<span
				className={`inline-flex items-center justify-center text-[10px] font-medium text-muted-foreground uppercase ${className}`}
				style={{ width: size, height: size }}
				title={provider}
			>
				{provider.slice(0, 2)}
			</span>
		);
	}

	return (
		<span
			className={`inline-flex items-center justify-center text-foreground/70 dark:text-foreground/80 ${className}`}
			style={{ width: size, height: size }}
			title={provider}
			dangerouslySetInnerHTML={{
				__html: logoSvg.replace(
					/<svg/,
					`<svg width="${size}" height="${size}" style="width:${size}px;height:${size}px"`
				),
			}}
		/>
	);
});
