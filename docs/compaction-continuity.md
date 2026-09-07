# Compaction continuity

Compaction replaces model-visible history with one canonical session checkpoint, rather than retaining a growing set of summaries and recent turns. The persisted checkpoint remains bounded to 6,000 characters.

The summarizer receives the previous checkpoint plus bounded evidence since that checkpoint:

- User instructions across the available history have reserved space, so long tool loops do not crowd out the original request or intermediate obligations.
- The remaining space favors the most recent execution evidence. Messages and their parts stay in chronological order, including tool calls before their results.
- Long evidence retains both its beginning and end with an explicit omission marker, preserving trailing errors and outcomes rather than only log prefixes.
- The input budget includes the previous checkpoint and section separators. A requested cutoff must exist; later messages are not summarized.

The checkpoint prompt prioritizes original intent, unresolved requests, current execution state, exact continuation identifiers, and the next steps. Completed exploration is shortened first. Each new checkpoint merges and replaces the previous one; omissions are not evidence of completion.

Automatic summarization allows up to 2,400 output tokens to produce the bounded checkpoint. If the provider reports an output-length cutoff, the summary is not installed as a checkpoint; the existing flow falls back to pruning tool results without replacing the session history.

This is still lossy summarization, not an archive. Full messages remain persisted for history access, and durable files remain the source of truth for implementation details. Model-generated handoff quality still depends on the summarizing model.

Regression coverage: `bun test tests/compaction-checkpoint.test.ts`.
