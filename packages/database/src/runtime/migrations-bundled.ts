import mig0000 from '../../drizzle/0000_material_swarm.sql' with {
	type: 'text',
};

export const bundledMigrations: Array<{ name: string; content: string }> = [
	{ name: '0000_material_swarm.sql', content: mig0000 },
];
