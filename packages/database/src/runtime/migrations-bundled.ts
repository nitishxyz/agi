// Bundled Drizzle migrations for single-binary builds
// These imports ensure Bun embeds the SQL files into the executable.
// Order matters: keep in incremental order.
import mig0000 from '../../drizzle/0000_tense_shadow_king.sql' with {
	type: 'text',
};
import mig0001 from '../../drizzle/0001_past_kabuki.sql' with { type: 'text' };
import mig0002 from '../../drizzle/0002_vengeful_warlock.sql' with {
	type: 'text',
};
import mig0003 from '../../drizzle/0003_pale_violations.sql' with {
	type: 'text',
};
import mig0004 from '../../drizzle/0004_left_the_professor.sql' with {
	type: 'text',
};
import mig0005 from '../../drizzle/0005_hard_gravity.sql' with { type: 'text' };

export const bundledMigrations: Array<{ name: string; content: string }> = [
	{ name: '0000_tense_shadow_king.sql', content: mig0000 },
	{ name: '0001_past_kabuki.sql', content: mig0001 },
	{ name: '0002_vengeful_warlock.sql', content: mig0002 },
	{ name: '0003_pale_violations.sql', content: mig0003 },
	{ name: '0004_left_the_professor.sql', content: mig0004 },
	{ name: '0005_hard_gravity.sql', content: mig0005 },
];
