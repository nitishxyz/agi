// Bundled Drizzle migrations for single-binary builds
// These imports ensure Bun embeds the SQL files into the executable.
// Order matters: keep in incremental order.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Bun import attributes
import mig0000 from '../../drizzle/0000_tense_shadow_king.sql' with { type: 'file' };
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Bun import attributes
import mig0001 from '../../drizzle/0001_past_kabuki.sql' with { type: 'file' };

export const bundledMigrations: Array<{ name: string; path: string }> = [
  { name: '0000_tense_shadow_king.sql', path: mig0000 },
  { name: '0001_past_kabuki.sql', path: mig0001 },
];

