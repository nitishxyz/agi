import { providerLogos } from "../assets/provider-logos";

interface ProviderLogoProps {
	provider: string;
	size?: number;
	className?: string;
}

export function ProviderLogo({ provider, size = 16, className = "" }: ProviderLogoProps) {
	const logoSvg = providerLogos[provider.toLowerCase()];

	if (!logoSvg) {
		return (
			<span
				className={`inline-flex items-center justify-center text-[10px] font-medium uppercase ${className}`}
				style={{ width: size, height: size }}
			>
				{provider.slice(0, 2)}
			</span>
		);
	}

	return (
		<span
			className={`inline-flex items-center justify-center ${className}`}
			style={{ width: size, height: size }}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: SVG logos are hardcoded trusted content
			dangerouslySetInnerHTML={{
				__html: logoSvg.replace(
					/<svg/,
					`<svg width="${size}" height="${size}" style="width:${size}px;height:${size}px"`,
				),
			}}
		/>
	);
}
