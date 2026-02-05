import { useState, useEffect } from "react";

interface ReleaseAsset {
	name: string;
	size: number;
	url: string;
}

interface ReleaseInfo {
	version: string;
	tag: string;
	macosArm: ReleaseAsset | null;
	macosIntel: ReleaseAsset | null;
	linuxAppImage: ReleaseAsset | null;
}

const FALLBACK: ReleaseInfo = {
	version: "0.1.22",
	tag: "desktop-v0.1.22",
	macosArm: {
		name: "otto_0.1.22_aarch64.dmg",
		size: 44346139,
		url: "https://github.com/nitishxyz/otto/releases/download/desktop-v0.1.22/otto_0.1.22_aarch64.dmg",
	},
	macosIntel: {
		name: "otto_0.1.22_x64.dmg",
		size: 44000000,
		url: "https://github.com/nitishxyz/otto/releases/download/desktop-v0.1.22/otto_0.1.22_x64.dmg",
	},
	linuxAppImage: {
		name: "otto_0.1.22_amd64.AppImage",
		size: 125000000,
		url: "https://github.com/nitishxyz/otto/releases/download/desktop-v0.1.22/otto_0.1.22_amd64.AppImage",
	},
};

function parseAssets(tag: string, assets: Array<{ name: string; size: number; browser_download_url: string }>): ReleaseInfo {
	const version = tag.replace("desktop-v", "");
	let macosArm: ReleaseAsset | null = null;
	let macosIntel: ReleaseAsset | null = null;
	let linuxAppImage: ReleaseAsset | null = null;

	for (const a of assets) {
		const asset: ReleaseAsset = { name: a.name, size: a.size, url: a.browser_download_url };
		if (a.name.endsWith("_aarch64.dmg")) macosArm = asset;
		else if (a.name.endsWith("_x64.dmg") || a.name.endsWith("_x86_64.dmg")) macosIntel = asset;
		else if (a.name.endsWith(".AppImage")) linuxAppImage = asset;
	}

	return { version, tag, macosArm, macosIntel, linuxAppImage };
}

export function useLatestRelease() {
	const [release, setRelease] = useState<ReleaseInfo>(FALLBACK);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		fetch("https://api.github.com/repos/nitishxyz/otto/releases/latest")
			.then((r) => r.json())
			.then((data) => {
				if (cancelled) return;
				if (data.tag_name && data.assets) {
					setRelease(parseAssets(data.tag_name, data.assets));
				}
			})
			.catch(() => {})
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, []);

	return { release, loading };
}
