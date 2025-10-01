#!/usr/bin/env bash
set -e

echo "🧹 AGI Monorepo Cleanup Script"
echo ""
echo "This will remove old code that has been migrated to the monorepo structure."
echo ""

# Create backup directory
BACKUP_DIR="../agi-backup-$(date +%Y%m%d-%H%M%S)"
echo "📦 Creating backup at: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Function to backup and remove
backup_and_remove() {
    local item=$1
    if [ -e "$item" ]; then
        echo "  Moving $item to backup..."
        cp -r "$item" "$BACKUP_DIR/"
        rm -rf "$item"
        echo "  ✅ Removed $item"
    else
        echo "  ⏭️  $item doesn't exist, skipping"
    fi
}

echo ""
echo "🗑️  Removing old source code..."
echo ""

# Remove old src directory (now in packages/)
backup_and_remove "src"

# Remove old index.ts (now in apps/cli/)
backup_and_remove "index.ts"

# Remove old drizzle directory (now in packages/database/)
backup_and_remove "drizzle"

# Remove old drizzle.config.ts (now in packages/database/)
backup_and_remove "drizzle.config.ts"

# Remove old dist directory (now apps/cli/dist/)
backup_and_remove "dist"

# Remove old cli.cjs if it exists (replaced by apps/cli/)
backup_and_remove "cli.cjs"

echo ""
echo "🧼 Cleanup complete!"
echo ""
echo "📊 Summary:"
echo "  - Backup created at: $BACKUP_DIR"
echo "  - Old code removed"
echo "  - Monorepo structure is now active"
echo ""
echo "📁 New structure:"
echo "  - CLI: apps/cli/"
echo "  - Packages: packages/*/"
echo "  - Build: cd apps/cli && bun run build"
echo ""
echo "✨ You can delete the backup after verifying everything works!"
