const cwdMap = new Map<string, string>();

export function getCwd(sessionId: string): string {
  return cwdMap.get(sessionId) ?? '.';
}

export function setCwd(sessionId: string, cwd: string) {
  cwdMap.set(sessionId, cwd || '.');
}

// normalize relative path like './a/../b' -> 'b', never escapes above '.'
export function normalizeRelative(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  const stack: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (stack.length > 0) stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.length ? stack.join('/') : '.';
}

export function joinRelative(base: string, p: string): string {
  if (!p || p === '.') return base || '.';
  if (p.startsWith('/')) return p.slice(1); // treat "/foo" as project-root absolute -> 'foo'
  return normalizeRelative(`${base || '.'}/${p}`);
}

