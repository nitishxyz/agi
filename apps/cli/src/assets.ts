// Embedded text assets to support single-binary builds reading project docs.
// These imports are optional at runtime but included when compiling with assets.
// Build step should include these files as additional entrypoints.
// Example build: bun build --compile --asset-naming="[name].[ext]" \
//   ./index.ts ./drizzle/**/*.sql ./drizzle/meta/**/*.json ./README.md ./AGENTS.md ./CLAUDE.md --outfile otto

// Root-relative from apps/cli/src/assets.ts
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import README from '../../../README.md' with { type: 'file' };
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import AGENTS from '../../../AGENTS.md' with { type: 'file' };
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import CLAUDE from '../../../CLAUDE.md' with { type: 'file' };

export const embeddedTextAssets: Record<string, string> = {
	'README.md': README,
	'AGENTS.md': AGENTS,
	'CLAUDE.md': CLAUDE,
};
