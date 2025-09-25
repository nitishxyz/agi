# Agents & Tools

[← Back to README](../README.md) • [Docs Index](./index.md)

## Built-in Agents

| Agent | Purpose | Default Tools |
|-------|---------|---------------|
| general | General-purpose assistant | Minimal tool access |
| build | Code generation and build tasks | File system, bash, git |
| plan | Strategic planning and architecture | Read-only tools |
| git | Git operations and review | Git tools, file reading |

## Built-in Tools

### File System Operations
- `read` - Read files from the filesystem
- `write` - Write files to the filesystem
- `ls` - List directory contents
- `tree` - Display a directory tree

### Git Operations
- `git_status` - Show working tree status
- `git_diff` - Show changes between commits
- `git_commit` - Create a new commit
- `git_log` - Show commit logs

### Advanced Operations
- `ripgrep` - Search file contents with regex
- `edit` - Perform structured edits on files (replace, insert, delete)
- `apply_patch` - Apply a unified diff patch to the project
- `bash` - Execute shell commands safely

### Agent Communication
- `progress_update` - Provide status updates during long operations
- `finish` - Mark task completion
- `update_plan` - Publish or update the execution plan for the user
