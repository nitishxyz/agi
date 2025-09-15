// Shared types and helpers for tool artifacts persisted in message parts.

export type FileDiffArtifact = {
  kind: 'file_diff';
  patchFormat: 'unified';
  patch: string; // full unified patch text
  summary?: { files?: number; additions?: number; deletions?: number };
};

export type FileArtifact = {
  kind: 'file';
  path: string; // repository-relative path
  mime?: string;
  size?: number;
  sha256?: string;
};

export type Artifact = FileDiffArtifact | FileArtifact | { kind: string; [k: string]: unknown };

export function createFileDiffArtifact(
  patch: string,
  summary?: { files?: number; additions?: number; deletions?: number },
): FileDiffArtifact {
  return { kind: 'file_diff', patchFormat: 'unified', patch, summary };
}

export function createToolResultPayload(name: string, result?: unknown, artifact?: Artifact) {
  const payload: any = { name };
  if (result !== undefined) payload.result = result;
  if (artifact) payload.artifact = artifact;
  return payload as { name: string; result?: unknown; artifact?: Artifact };
}

