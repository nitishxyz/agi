# Contributing

[← Back to README](../README.md) • [Docs Index](./index.md)

Please read `AGENTS.md` for contributor conventions and guidelines.

## Key Guidelines

1. Use Bun exclusively — no npm/yarn/pnpm commands
2. Follow existing patterns — check similar code before implementing
3. Biome for linting — run `bun lint` before committing
4. Path aliases — use `@/` imports instead of relative paths
5. Minimal changes — keep PRs focused and avoid unrelated refactors
6. Test coverage — add tests for new features
7. TypeScript strict mode — maintain type safety

## Commit Convention

Keep commits focused and descriptive. Reference issues when applicable:

```bash
git commit -m "feat(agents): add custom tool loader"
git commit -m "fix(cli): handle missing config gracefully"
git commit -m "docs: update API reference"
```
