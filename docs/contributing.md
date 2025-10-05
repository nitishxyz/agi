# Contributing to AGI CLI

Thank you for your interest in contributing to AGI CLI! This guide will help you get started.

> **Note:** If you're an AI agent (like Claude), please also read [../AGENTS.md](../AGENTS.md) for additional guidelines and conventions.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style & Conventions](#code-style--conventions)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Areas Where Help Is Needed](#areas-where-help-is-needed)

## Code of Conduct

By participating in this project, you agree to:

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the project's goals
- Help maintain a welcoming community

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) v1.0 or higher
- Git
- Code editor (VS Code recommended)

### Setting Up Development Environment

```bash
# Clone the repository
git clone https://github.com/nitishxyz/agi.git
cd agi

# Install dependencies
bun install

# Run the CLI in development mode
cd apps/cli
bun run dev

# Run tests
cd ../..
bun test
```

### Project Structure

AGI is a monorepo with the following structure:

```
agi/
├── apps/
│   ├── cli/          # Main CLI application
│   └── web/          # Web interface
├── packages/
│   ├── auth/         # Authentication
│   ├── config/       # Configuration
│   ├── database/     # SQLite + Drizzle
│   ├── install/      # npm installer
│   ├── prompts/      # System prompts
│   ├── providers/    # Provider catalog
│   ├── sdk/          # Core SDK
│   ├── server/       # HTTP server
│   └── web-ui/       # Web UI components
├── docs/             # Documentation
└── tests/            # Test files
```

See [architecture.md](architecture.md) for detailed architecture information.

## Development Workflow

### Making Changes

1. **Create a new branch:**

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. **Make your changes:**
   - Keep changes focused and atomic
   - Follow the code style guidelines (see below)
   - Add tests for new functionality

3. **Test your changes:**

   ```bash
   # Run all tests
   bun test

   # Run linter
   bun lint

   # Test CLI in development
   cd apps/cli
   bun run dev --help
   ```

4. **Commit your changes:**

   ```bash
   git add .
   git commit -m "feat: add new feature"
   # or
   git commit -m "fix: resolve issue with..."
   ```

   **Commit Message Format:**
   - `feat:` - New features
   - `fix:` - Bug fixes
   - `docs:` - Documentation changes
   - `refactor:` - Code refactoring
   - `test:` - Test additions/changes
   - `chore:` - Maintenance tasks

5. **Push and create a pull request:**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then create a PR on GitHub.

## Code Style & Conventions

### Formatting and Linting

- **Use Biome** for linting/formatting: `bun lint`
- Do not disable rules globally
- If an exception is required, limit scope and add rationale in PR description
- Keep imports sorted and remove unused code

### Modular Structure

- **Prefer many small, focused modules** over large files
- One route module per endpoint group
- One schema/table per file under `packages/database/src/schema/`
- Avoid circular dependencies
- If a module grows beyond ~200–300 lines, consider refactoring

### Package Imports

Use workspace package imports for cross-package dependencies:

- `@agi-cli/auth` - Authentication & credentials
- `@agi-cli/config` - Configuration system
- `@agi-cli/database` - SQLite + Drizzle ORM
- `@agi-cli/prompts` - System prompts
- `@agi-cli/providers` - AI provider catalog
- `@agi-cli/sdk` - Core SDK (tools, streaming, agents)
- `@agi-cli/server` - HTTP server
- `@agi-cli/web-ui` - Web UI components

**Rules:**
- Use workspace imports (`@agi-cli/...`) for cross-package dependencies
- Use relative imports (`./`, `../`) within the same package only
- **Never use `@/` path aliases** (removed during monorepo migration)

### TypeScript

- Always use TypeScript strict mode
- Add JSDoc comments to exported functions
- Prefer functional programming patterns where appropriate
- No `any` types unless absolutely necessary (add comment explaining why)

## Testing

### Writing Tests

- Write tests for new features and bug fixes
- Use Bun test framework (`bun:test`)
- Tests live in `tests/` directory
- Test files should end with `.test.ts`

**Example:**

```typescript
import { test, expect } from "bun:test";

test("example test", () => {
  expect(1 + 1).toBe(2);
});
```

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/my-feature.test.ts

# Run with coverage
bun test --coverage
```

## Submitting Changes

### Pull Request Guidelines

1. **Create a focused PR** - One feature or fix per PR
2. **Write a clear description** - Explain what and why
3. **Link related issues** - Use "Fixes #123" or "Relates to #456"
4. **Update documentation** - If you change behavior, update docs
5. **Add tests** - New features should include tests
6. **Ensure CI passes** - All checks must pass before merge

### PR Template

```markdown
## Description

Brief description of changes

## Changes

- Change 1
- Change 2

## Testing

- [ ] Tests added/updated
- [ ] Linting passes (`bun lint`)
- [ ] All tests pass (`bun test`)
- [ ] Manual testing completed

## Documentation

- [ ] README updated (if needed)
- [ ] Docs updated (if needed)
- [ ] JSDoc comments added

## Related Issues

Fixes #123
```

## Areas Where Help Is Needed

We especially welcome contributions in these areas:

- 📝 **Documentation improvements** - Clarify, expand, or fix docs
- 🧪 **Test coverage** - Add tests for existing code
- 🔧 **New built-in tools** - Add useful tools to the SDK
- 🌐 **Web UI enhancements** - Improve the web interface
- 🐛 **Bug fixes** - Fix reported issues
- 🎨 **Examples** - Create example projects showing AGI usage

## Getting Help

- **Documentation**: Check [docs/](.) first
- **Issues**: Search existing issues before creating new ones
- **Discussions**: Use GitHub Discussions for questions
- **Architecture**: See [architecture.md](architecture.md)
- **Development**: See [development.md](development.md)

## Additional Resources

- **AI Agent Guidelines**: [../AGENTS.md](../AGENTS.md) - Detailed conventions for AI contributors
- **Architecture**: [architecture.md](architecture.md) - System design
- **Development**: [development.md](development.md) - Development workflow
- **Publishing**: [publishing.md](publishing.md) - Release process

## License

By contributing to AGI CLI, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to AGI CLI! 🙏
