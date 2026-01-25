# Publishing Guide

This document describes how to publish the AGI CLI and SDK packages.

## Packages

### `@agi-cli/install`

npm installer package that downloads the AGI CLI binary.

- **Location:** `packages/install/`
- **Package name:** `@agi-cli/install`
- **Purpose:** Simplify global installation via npm/bun
- **Publishes:** npm only (no binaries)

### `@agi-cli/sdk`

The core SDK for building AI agents and tools.

- **Location:** `packages/sdk/`
- **Package name:** `@agi-cli/sdk`
- **Purpose:** Library for developers building custom agents
- **Publishes:** npm only

## Publishing Methods

### Method 1: Automatic Release (Recommended)

Push to `main` branch triggers automatic release:

```bash
git push origin main
```

**What happens:**

1. Checks install version in `packages/install/package.json`
2. If tag exists, auto-bumps patch version
3. Updates version across all packages (sync)
4. Builds binaries for all platforms:
   - macOS (x64, ARM64)
   - Linux (x64, ARM64)
   - Windows (x64)
5. Creates GitHub release with binaries
6. Publishes `@agi-cli/install` to npm
7. Publishes `@agi-cli/sdk` to npm

**Workflow:** `.github/workflows/release-binaries.yml`

---

### Method 2: Manual Tag Release

Publish a specific git tag:

```bash
# 1. Update version in package.json files
# 2. Commit and create tag
git tag v0.1.29
git push origin v0.1.29

# 3. Trigger workflow in GitHub Actions UI:
#    - Go to Actions > "Publish From Tag"
#    - Click "Run workflow"
#    - Enter tag: v0.1.29
```

**What happens:**

1. Checks out the specific tag
2. Builds binaries for all platforms
3. Creates GitHub release with binaries
4. Publishes `@agi-cli/install` and `@agi-cli/sdk` to npm

**Workflow:** `.github/workflows/publish-from-tag.yml`

---

## Version Management

### Version Sync

Versions are automatically synchronized across packages by the `scripts/bump-version.ts` script:

- `packages/install/package.json` (installer version - source of truth for publishing)
- `apps/cli/package.json` (CLI version - kept in sync but not published)
- `packages/sdk/package.json` (SDK version)
- `README.md` badge version
- `docs/getting-started.md` pinned install version

**Important:** The CI will sync all package versions automatically.

### Version Bumping

**Automatic (via CI):**

```bash
# Push to main - CI auto-bumps if tag exists
git push origin main
```

The CI workflow will:

1. Check if current version tag exists
2. If exists, bump patch version (0.1.28 → 0.1.29)
3. Update all package.json files
4. Create commit with `[skip ci]`
5. Create new tag
6. Trigger release workflow

**Manual:**

```bash
# Run version bump script
bun run scripts/bump-version.ts 0.1.29

# Or manually update package.json files
vim apps/cli/package.json            # Update "version"
vim packages/install/package.json    # Update "version"
vim packages/sdk/package.json        # Update "version"

# Commit and tag
git add .
git commit -m "chore: bump version to 0.1.29"
git tag v0.1.29
git push origin main --tags
```

---

## GitHub Actions Secrets

Required secrets in repository settings:

- **`NPM_TOKEN`** - npm publish token
  - Create at https://www.npmjs.com/settings/[username]/tokens
  - Type: "Automation" token
  - Scope: Read and Publish

---

## Build Scripts

### CLI Build Scripts (apps/cli/)

```bash
# Local build
bun run build                    # Current platform

# Platform-specific builds
bun run build:darwin-arm64       # macOS ARM64
bun run build:darwin-x64         # macOS x64
bun run build:linux-x64          # Linux x64
bun run build:linux-arm64        # Linux ARM64
bun run build:windows-x64        # Windows x64
```

### Output Location

- All binaries: `apps/cli/dist/`
- Default: `dist/agi`
- Platform-specific: `dist/agi-{os}-{arch}`

---

## Publishing Workflow Details

### Binary Build Process

1. **Install dependencies:**

   ```bash
   bun install
   ```

2. **Build for each platform:**

   ```bash
   cd apps/cli
   bun run build:{platform}
   ```

3. **Upload artifacts:**
   - Artifacts stored in GitHub Actions
   - Downloaded and attached to GitHub release

### npm Publish Process

1. **Configure npm authentication:**

   ```bash
   echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc
   ```

2. **Publish installer:**

   ```bash
   cd packages/install
   bun publish --access public --tag latest
   ```

3. **Publish SDK:**
   ```bash
   cd packages/sdk
   bun publish --access public --tag latest
   ```

---

## Verification

After publishing, verify:

### 1. GitHub Release

- Go to: https://github.com/nitishxyz/agi/releases
- Check: All platform binaries attached
- Test: Download and run binary

### 2. npm Packages

**Installer:**

```bash
npm view @agi-cli/install
npm install -g @agi-cli/install
agi --version
```

**SDK:**

```bash
npm view @agi-cli/sdk
npm install @agi-cli/sdk
```

---

## Troubleshooting

### Build Fails

**Check:**

1. All packages compile: `bun run build:all`
2. TypeScript errors: `bun lint`
3. Dependencies installed: `bun install`

### npm Publish Fails

**Check:**

1. `NPM_TOKEN` secret is set
2. Version doesn't already exist on npm
3. Package.json has correct `name` and `version`
4. All package versions are synchronized

### Binary Doesn't Work

**Check:**

1. Build output includes all 684 modules
2. Binary is executable: `chmod +x apps/cli/dist/agi`
3. Test locally first: `cd apps/cli && bun run build`

### Version Sync Issues

**Check:**

1. All package.json files have matching versions
2. Run version sync script: `bun run scripts/bump-version.ts`
3. Check git tags: `git tag -l`

---

## Release Checklist

Before releasing:

- [ ] Update CHANGELOG (if exists)
- [ ] Test CLI locally: `cd apps/cli && bun run dev`
- [ ] Test build: `cd apps/cli && bun run build`
- [ ] Test binary: `./apps/cli/dist/agi --version`
- [ ] Verify version sync across all packages
- [ ] Run tests: `bun test`
- [ ] Commit all changes
- [ ] Push to main or create tag

---

## Package Structure

```
agi/
├── apps/
│   ├── cli/
│   │   ├── dist/              # Build output
│   │   ├── package.json       # CLI version, bin entry
│   │   └── index.ts          # CLI entry point
│   └── web/
│       └── ...               # Web application
├── packages/
│   ├── install/
│   │   ├── start.js          # Postinstall script
│   │   ├── package.json      # Installer config
│   │   └── README.md         # Installer docs
│   └── sdk/
│       ├── src/              # SDK source
│       └── package.json      # SDK version, exports
└── .github/
    └── workflows/
        ├── release-binaries.yml    # Auto-release on push
        └── publish-from-tag.yml    # Manual tag release
```

---

## Installation Flow

### User installs via npm

```
User: npm install -g @agi-cli/install
  ↓
npm: Download @agi-cli/install package
  ↓
npm: Run postinstall (packages/install/start.js)
  ↓
Script: Detect platform (darwin-arm64, linux-x64, etc.)
  ↓
Script: Download binary from https://install.agi.nitish.sh
  ↓
Script: Install to /usr/local/bin or ~/.local/bin
  ↓
User: agi --version ✓
```

### Installer Package Benefits

1. **Standard npm workflow**: Familiar to developers
2. **Automatic updates**: `npm update -g @agi-cli/install`
3. **Cross-platform**: Works on all platforms
4. **Small package size**: ~560 bytes (downloads binary separately)
5. **PATH management**: Handles installation directory automatically

---

## Post-Release

After successful release:

1. **Announce release** (if needed)
2. **Update documentation** (if needed)
3. **Test all installation methods:**

   ```bash
   # Test npm install
   npm install -g @agi-cli/install@latest
   agi --version

   # Test curl install
   curl -fsSL https://install.agi.nitish.sh | sh
   agi --version
   ```

4. **Monitor for issues** in GitHub Issues

---

## Summary

- **Two packages published to npm:** `@agi-cli/install` (installer), `@agi-cli/sdk` (library)
- **Binaries published to GitHub releases:** Platform-specific CLI binaries
- **Push to main** → Auto-release all packages with version sync
- **Manual tag** → Release specific version
- **All platforms supported:** macOS, Linux, Windows (x64, ARM64)
- **Automated via GitHub Actions** with version synchronization
- **npm installer package** provides easiest installation experience
