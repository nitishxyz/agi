import { useState, useEffect } from 'react';

interface ReleaseAsset {
	name: string;
	size: number;
	url: string;
}

interface LauncherReleaseInfo {
	version: string;
	tag: string;
	macosArm: ReleaseAsset | null;
	macosIntel: ReleaseAsset | null;
	linuxDeb: ReleaseAsset | null;
	linuxDebArm: ReleaseAsset | null;
	windowsMsi: ReleaseAsset | null;
	windowsExe: ReleaseAsset | null;
}

const FALLBACK: LauncherReleaseInfo = {
	version: '0.1.0',
	tag: 'launcher-v0.1.0',
	macosArm: {
		name: 'otto-launcher_0.1.0_aarch64.dmg',
		size: 12000000,
		url: 'https://github.com/nitishxyz/otto/releases/download/launcher-v0.1.0/otto-launcher_0.1.0_aarch64.dmg',
	},
	macosIntel: {
		name: 'otto-launcher_0.1.0_x64.dmg',
		size: 12000000,
		url: 'https://github.com/nitishxyz/otto/releases/download/launcher-v0.1.0/otto-launcher_0.1.0_x64.dmg',
	},
	linuxDeb: {
		name: 'otto-launcher_0.1.0_amd64.deb',
		size: 15000000,
		url: 'https://github.com/nitishxyz/otto/releases/download/launcher-v0.1.0/otto-launcher_0.1.0_amd64.deb',
	},
	linuxDebArm: {
		name: 'otto-launcher_0.1.0_arm64.deb',
		size: 15000000,
		url: 'https://github.com/nitishxyz/otto/releases/download/launcher-v0.1.0/otto-launcher_0.1.0_arm64.deb',
	},
	windowsMsi: {
		name: 'otto-launcher_0.1.0_x64-setup.msi',
		size: 10000000,
		url: 'https://github.com/nitishxyz/otto/releases/download/launcher-v0.1.0/otto-launcher_0.1.0_x64-setup.msi',
	},
	windowsExe: null,
};

function parseAssets(
	tag: string,
	assets: Array<{ name: string; size: number; browser_download_url: string }>,
): LauncherReleaseInfo {
	const version = tag.replace('launcher-v', '');
	let macosArm: ReleaseAsset | null = null;
	let macosIntel: ReleaseAsset | null = null;
	let linuxDeb: ReleaseAsset | null = null;
	let linuxDebArm: ReleaseAsset | null = null;
	let windowsMsi: ReleaseAsset | null = null;
	let windowsExe: ReleaseAsset | null = null;

	for (const a of assets) {
		const asset: ReleaseAsset = {
			name: a.name,
			size: a.size,
			url: a.browser_download_url,
		};
		if (a.name.endsWith('_aarch64.dmg')) macosArm = asset;
		else if (a.name.endsWith('_x64.dmg') || a.name.endsWith('_x86_64.dmg'))
			macosIntel = asset;
		else if (a.name.endsWith('.msi')) windowsMsi = asset;
		else if (a.name.endsWith('.exe') && !a.name.endsWith('.exe.sig'))
			windowsExe = asset;
		else if (a.name.endsWith('.deb')) {
			if (a.name.includes('arm64') || a.name.includes('aarch64'))
				linuxDebArm = asset;
			else linuxDeb = asset;
		}
	}

	return {
		version,
		tag,
		macosArm,
		macosIntel,
		linuxDeb,
		linuxDebArm,
		windowsMsi,
		windowsExe,
	};
}

export function useLatestLauncherRelease() {
	const [release, setRelease] = useState<LauncherReleaseInfo>(FALLBACK);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		fetch('https://api.github.com/repos/nitishxyz/otto/releases?per_page=50')
			.then((r) => r.json())
			.then((data) => {
				if (cancelled) return;
				if (!Array.isArray(data)) return;
				const launcherReleases = data
					.filter((rel: { tag_name?: string }) =>
						rel.tag_name?.startsWith('launcher-v'),
					)
					.sort(
						(a: { published_at: string }, b: { published_at: string }) =>
							new Date(b.published_at).getTime() -
							new Date(a.published_at).getTime(),
					);
				for (const rel of launcherReleases) {
					const parsed = parseAssets(rel.tag_name, rel.assets ?? []);
					if (parsed.macosArm || parsed.linuxDeb || parsed.windowsMsi) {
						setRelease(parsed);
						break;
					}
				}
			})
			.catch(() => {})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return { release, loading };
}
