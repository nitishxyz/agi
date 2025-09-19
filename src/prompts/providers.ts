// Provider-specific base prompts loader.
// Loads src/prompts/providers/<provider>.txt and returns its contents (trimmed).

export async function providerBasePrompt(
  provider: string,
  _modelId: string | undefined,
  _projectRoot: string,
): Promise<string> {
  const id = String(provider || '').toLowerCase();
  const basePath = `src/prompts/providers/${id}.txt`;
  try {
    const f = Bun.file(basePath);
    if (await f.exists()) {
      const text = await f.text();
      return String(text || '').trim();
    }
  } catch {}
  return '';
}
