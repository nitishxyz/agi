import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

type ReleaseType = 'major' | 'minor' | 'patch' | 'prerelease';

interface CliArgs {
	type?: ReleaseType;
	preid?: string;
	dryRun: boolean;
}

function parseArgs(argv: string[]): CliArgs {
	const args: CliArgs = { dryRun: false };

	for (let index = 0; index < argv.length; index += 1) {
		const current = argv[index];

		if (current === '--help' || current === '-h') {
			printUsage();
			process.exit(0);
		}

		if (current === '--dry-run') {
			args.dryRun = true;
			continue;
		}

		if (current === '--type') {
			const value = argv[index + 1];
			if (!value) {
				throw new Error('Missing value for --type');
			}

			args.type = castReleaseType(value);
			index += 1;
			continue;
		}

		if (current === '--preid') {
			const value = argv[index + 1];
			if (!value) {
				throw new Error('Missing value for --preid');
			}

			args.preid = value;
			index += 1;
			continue;
		}

		throw new Error(`Unknown argument: ${current}`);
	}

	return args;
}

function castReleaseType(value: string): ReleaseType {
	const allowed: ReleaseType[] = ['major', 'minor', 'patch', 'prerelease'];
	if ((allowed as string[]).includes(value)) {
		return value as ReleaseType;
	}
	throw new Error(`Unsupported release type: ${value}`);
}

function incrementVersion(
	version: string,
	type: ReleaseType,
	preid?: string,
): string {
	const match = version.match(
		/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/,
	);
	if (!match) {
		throw new Error(`Invalid semver: ${version}`);
	}

	let [major, minor, patch] = match
		.slice(1, 4)
		.map((segment) => Number.parseInt(segment, 10));
	let pre = match[4];

	switch (type) {
		case 'major': {
			major += 1;
			minor = 0;
			patch = 0;
			pre = undefined;
			break;
		}
		case 'minor': {
			minor += 1;
			patch = 0;
			pre = undefined;
			break;
		}
		case 'patch': {
			if (pre) {
				pre = undefined;
			} else {
				patch += 1;
			}
			break;
		}
		case 'prerelease': {
			const identifier = preid ?? 'beta';
			if (!pre) {
				patch += 1;
				pre = `${identifier}.0`;
				break;
			}

			const nextPre = nextPreRelease(pre, identifier);
			pre = nextPre;
			break;
		}
	}

	return pre
		? `${major}.${minor}.${patch}-${pre}`
		: `${major}.${minor}.${patch}`;
}

function nextPreRelease(current: string, identifier: string): string {
	const lastDot = current.lastIndexOf('.');
	const baseId = lastDot === -1 ? current : current.slice(0, lastDot);
	const maybeNumber =
		lastDot === -1
			? Number.NaN
			: Number.parseInt(current.slice(lastDot + 1), 10);

	if (baseId === identifier && Number.isInteger(maybeNumber)) {
		return `${identifier}.${maybeNumber + 1}`;
	}

	return `${identifier}.0`;
}

function printUsage() {
	console.log(
		'Usage: bun run scripts/bump-version.ts --type <major|minor|patch|prerelease> [--preid beta] [--dry-run]',
	);
}

function main() {
	const { type, preid, dryRun } = parseArgs(process.argv.slice(2));
	if (!type) {
		printUsage();
		throw new Error('--type is required');
	}

	const packagePath = resolve(process.cwd(), 'package.json');
	const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as {
		version?: string;
	};

	if (!packageJson.version) {
		throw new Error('package.json is missing a version field');
	}

	const nextVersion = incrementVersion(packageJson.version, type, preid);

	if (!dryRun) {
		packageJson.version = nextVersion;
		writeFileSync(packagePath, `${JSON.stringify(packageJson, null, '\t')}\n`);
	} else {
		console.error('Dry run enabled, not writing package.json');
	}

	console.log(nextVersion);
}

main();
