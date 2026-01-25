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
import mig0006 from '../../drizzle/0006_jazzy_warlock.sql' with {
	type: 'text',
};
import mig0007 from '../../drizzle/0007_milky_rhodey.sql' with { type: 'text' };
import mig0008 from '../../drizzle/0008_chunky_miss_america.sql' with {
	type: 'text',
};

export const bundledMigrations: Array<{ name: string; content: string }> = [
	{ name: '0000_tense_shadow_king.sql', content: mig0000 },
	{ name: '0001_past_kabuki.sql', content: mig0001 },
	{ name: '0002_vengeful_warlock.sql', content: mig0002 },
	{ name: '0003_pale_violations.sql', content: mig0003 },
	{ name: '0004_left_the_professor.sql', content: mig0004 },
	{ name: '0005_hard_gravity.sql', content: mig0005 },
	{ name: '0006_jazzy_warlock.sql', content: mig0006 },
	{ name: '0007_milky_rhodey.sql', content: mig0007 },
	{ name: '0008_chunky_miss_america.sql', content: mig0008 },
];
