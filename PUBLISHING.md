# Publishing Guide

This document describes how to publish the AGI CLI and SDK packages.

## Packages

### `@agi-cli/cli`
The main CLI application that users install.
- **Location:** `apps/cli/`
- **Package name:** `@agi-cli/cli`
- **Binary:** Standalone executable (61MB)
- **Publishes:** npm + GitHub releases with binaries

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
1. Checks CLI version in `apps/cli/package.json`
2. If tag exists, auto-bumps patch version
3. Builds binaries for all platforms:
   - macOS (x64, ARM64)
   - Linux (x64, ARM64)
   - Windows (x64)
4. Creates GitHub release with binaries
5. Publishes `@agi-cli/cli` to npm
6. Publishes `@agi-cli/sdk` to npm

**Workflow:** `.github/workflows/release-binaries.yml`

---

### Method 2: Manual Tag Release

Publish a specific git tag:

```bash
# 1. Update version in apps/cli/package.json and packages/sdk/package.json
# 2. Commit and create tag
git tag v0.1.27
git push origin v0.1.27

# 3. Trigger workflow in GitHub Actions UI:
#    - Go to Actions > "Publish From Tag"
#    - Click "Run workflow"
#    - Enter tag: v0.1.27
```

**What happens:**
1. Checks out the specific tag
2. Builds binaries for all platforms
3. Creates GitHub release with binaries
4. Publishes both packages to npm

**Workflow:** `.github/workflows/publish-from-tag.yml`

---

## Version Management

### Version Sync
Keep versions synchronized across:
- `apps/cli/package.json` (CLI version)
- `packages/sdk/package.json` (SDK version)

### Version Bumping

**Automatic (via CI):**
```bash
# Push to main - CI auto-bumps if tag exists
git push origin main
```

**Manual:**
```bash
# Update both package.json files
vim apps/cli/package.json     # Update "version"
vim packages/sdk/package.json  # Update "version"

# Commit and tag
git add .
git commit -m "chore: bump version to 0.1.27"
git tag v0.1.27
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

2. **Publish CLI:**
   ```bash
   cd apps/cli
   bun run build  # Build default binary
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
- Go to: https://github.com/ntishxyz/agi/releases
- Check: All platform binaries attached
- Test: Download and run binary

### 2. npm Packages

**CLI:**
```bash
npm view @agi-cli/cli
npm install -g @agi-cli/cli
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

### Binary Doesn't Work

**Check:**
1. Build output includes all 684 modules
2. Binary is executable: `chmod +x apps/cli/dist/agi`
3. Test locally first: `cd apps/cli && bun run build`

---

## Release Checklist

Before releasing:

- [ ] Update CHANGELOG (if exists)
- [ ] Test CLI locally: `cd apps/cli && bun run dev`
- [ ] Test build: `cd apps/cli && bun run build`
- [ ] Test binary: `./apps/cli/dist/agi --version`
- [ ] Verify version in both package.json files
- [ ] Run tests: `bun test`
- [ ] Commit all changes
- [ ] Push to main or create tag

---

## Package Structure

```
agi/
├── apps/
│   └── cli/
│       ├── dist/              # Build output
│       ├── package.json       # CLI version, bin entry
│       └── index.ts          # CLI entry point
├── packages/
│   └── sdk/
│       ├── src/              # SDK source
│       └── package.json      # SDK version, exports
└── .github/
    └── workflows/
        ├── release-binaries.yml    # Auto-release on push
        └── publish-from-tag.yml    # Manual tag release
```

---

## Post-Release

After successful release:

1. **Announce release** (if needed)
2. **Update documentation** (if needed)
3. **Test installation:**
   ```bash
   npm install -g @agi-cli/cli@latest
   agi --version
   ```
4. **Monitor for issues** in GitHub Issues

---

## Summary

- **Push to main** → Auto-release both packages
- **Manual tag** → Release specific version
- **Two packages published:** CLI (binary) + SDK (library)
- **All platforms supported:** macOS, Linux, Windows (x64, ARM64)
- **Automated via GitHub Actions**
