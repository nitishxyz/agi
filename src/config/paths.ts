// Utilities for resolving AGI config/data paths consistently
// Uses XDG base directory spec for global config: ~/.config/agi by default

// Minimal path join to avoid node:path; ensures forward slashes
function joinPath(...parts: string[]) {
  return parts
    .filter(Boolean)
    .map((p) => p.replace(/\\/g, '/'))
    .join('/')
    .replace(/\/+\/+/g, '/');
}

export function getHomeDir(): string {
  return (process.env.HOME || process.env.USERPROFILE || '').replace(/\\/g, '/');
}

export function getConfigHomeDir(): string {
  const cfgHome = process.env.XDG_CONFIG_HOME;
  if (cfgHome && cfgHome.trim()) return cfgHome.replace(/\\/g, '/');
  return joinPath(getHomeDir(), '.config');
}

export function getGlobalConfigDir(): string {
  return joinPath(getConfigHomeDir(), 'agi');
}

export function getGlobalConfigPath(): string {
  return joinPath(getGlobalConfigDir(), 'config.json');
}

export function getGlobalAuthPath(): string {
  return joinPath(getGlobalConfigDir(), 'auth.json');
}

// Secure location for auth secrets (not in config dir or project)
// - Linux: $XDG_STATE_HOME/agi/auth.json or ~/.local/state/agi/auth.json
// - macOS: ~/Library/Application Support/agi/auth.json
// - Windows: %APPDATA%\agi\auth.json
export function getSecureAuthPath(): string {
  const platform = process.platform;
  if (platform === 'darwin') {
    return joinPath(getHomeDir(), 'Library', 'Application Support', 'agi', 'auth.json');
  }
  if (platform === 'win32') {
    const appData = (process.env.APPDATA || '').replace(/\\/g, '/');
    const base = appData || joinPath(getHomeDir(), 'AppData', 'Roaming');
    return joinPath(base, 'agi', 'auth.json');
  }
  const stateHome = (process.env.XDG_STATE_HOME || '').replace(/\\/g, '/');
  const base = stateHome || joinPath(getHomeDir(), '.local', 'state');
  return joinPath(base, 'agi', 'auth.json');
}

// Global content under config dir
export function getGlobalAgentsJsonPath(): string {
  return joinPath(getGlobalConfigDir(), 'agents.json');
}

export function getGlobalAgentsDir(): string {
  return joinPath(getGlobalConfigDir(), 'agents');
}

export function getGlobalToolsDir(): string {
  return joinPath(getGlobalConfigDir(), 'tools');
}

export function getGlobalCommandsDir(): string {
  return joinPath(getGlobalConfigDir(), 'commands');
}

export function getLocalDataDir(projectRoot: string): string {
  return joinPath(projectRoot, '.agi');
}

export async function ensureDir(dir: string) {
  try {
    // Attempt to create a marker file to ensure directory exists
    await Bun.write(joinPath(dir, '.keep'), '');
  } catch {
    const { promises: fs } = await import('node:fs');
    await fs.mkdir(dir, { recursive: true }).catch(() => {});
  }
}

export async function fileExists(p: string) {
  return await Bun.file(p).exists();
}

export { joinPath };
