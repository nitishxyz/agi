// Type declarations for .sql file imports (Bun-specific)
declare module '*.sql' {
	const content: string;
	export default content;
}
