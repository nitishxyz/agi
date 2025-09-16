// Bundled Drizzle migrations for single-binary builds
// These imports ensure Bun embeds the SQL files into the executable.
// Order matters: keep in incremental order.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error - Bun import attributes
import mig0000 from '../../drizzle/0000_tense_shadow_king.sql' with {
	type: 'text',
};
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error - Bun import attributes
import mig0001 from '../../drizzle/0001_past_kabuki.sql' with { type: 'text' };

export const bundledMigrations: Array<{ name: string; content: string }> = [
	{ name: '0000_tense_shadow_king.sql', content: mig0000 },
	{ name: '0001_past_kabuki.sql', content: mig0001 },
];
