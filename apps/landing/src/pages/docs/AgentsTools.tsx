import { CodeBlock } from '../../components/CodeBlock';
export function AgentsTools() {
	return (
		<div>
			<h1 className="text-3xl font-bold mb-2">Agents & Tools</h1>
			<p className="text-otto-dim text-sm mb-8">
				Built-in agents, tools reference, and customization.
			</p>

			<h2>Agents</h2>
			<p>
				otto ships with four built-in agents. Each has a system prompt and
				curated toolset.
			</p>

			<h3>build</h3>
			<p>
				Code generation, bug fixes, feature implementation. Most capable agent
				with full filesystem and shell access.
			</p>
			<p>
				<strong>Tools:</strong> read, write, ls, tree, bash, update_todos, glob,
				ripgrep, git_status, terminal, apply_patch, websearch
			</p>
			<CodeBlock>{`otto ask "create an auth component" --agent build
otto ask "fix the failing test" --agent build`}</CodeBlock>

			<h3>plan</h3>
			<p>
				Architecture planning and code analysis. Read-only — cannot modify files
				or run commands.
			</p>
			<p>
				<strong>Tools:</strong> read, ls, tree, ripgrep, update_todos, websearch
			</p>
			<CodeBlock>{`otto ask "design the API architecture" --agent plan
otto ask "review the dependency graph" --agent plan`}</CodeBlock>

			<h3>general</h3>
			<p>General-purpose assistant for mixed tasks.</p>
			<p>
				<strong>Tools:</strong> read, write, ls, tree, bash, ripgrep, glob,
				websearch, update_todos
			</p>
			<CodeBlock>{`otto ask "explain how this module works" --agent general`}</CodeBlock>

			<h3>research</h3>
			<p>
				Deep research across sessions and the web. Can query past sessions for
				context.
			</p>
			<p>
				<strong>Tools:</strong> read, ls, tree, ripgrep, websearch,
				update_todos, query_sessions, query_messages, search_history
			</p>
			<CodeBlock>{`otto ask "research how auth is implemented" --agent research`}</CodeBlock>

			<p>
				All agents also receive: <code>progress_update</code>,{' '}
				<code>finish</code>, <code>skill</code>.
			</p>

			<h2>Tools</h2>

			<h3>File System</h3>
			<table>
				<thead>
					<tr>
						<th>Tool</th>
						<th>Description</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>
							<code>read</code>
						</td>
						<td>Read file contents. Supports line ranges.</td>
					</tr>
					<tr>
						<td>
							<code>write</code>
						</td>
						<td>Write content to a file. Creates if it doesn't exist.</td>
					</tr>
					<tr>
						<td>
							<code>ls</code>
						</td>
						<td>List directory contents (non-recursive).</td>
					</tr>
					<tr>
						<td>
							<code>tree</code>
						</td>
						<td>Render directory tree with configurable depth.</td>
					</tr>
					<tr>
						<td>
							<code>glob</code>
						</td>
						<td>Find files matching glob patterns.</td>
					</tr>
				</tbody>
			</table>

			<h3>Search</h3>
			<table>
				<thead>
					<tr>
						<th>Tool</th>
						<th>Description</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>
							<code>grep</code>
						</td>
						<td>Search file contents with regex.</td>
					</tr>
					<tr>
						<td>
							<code>ripgrep</code>
						</td>
						<td>Fast regex search using rg.</td>
					</tr>
					<tr>
						<td>
							<code>websearch</code>
						</td>
						<td>Search the web or fetch URL content.</td>
					</tr>
				</tbody>
			</table>

			<h3>Editing</h3>
			<table>
				<thead>
					<tr>
						<th>Tool</th>
						<th>Description</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>
							<code>edit</code>
						</td>
						<td>Structured file editing: replace, insert, delete.</td>
					</tr>
					<tr>
						<td>
							<code>apply_patch</code>
						</td>
						<td>Apply unified diff patches with fuzzy matching.</td>
					</tr>
				</tbody>
			</table>

			<h3>Shell</h3>
			<table>
				<thead>
					<tr>
						<th>Tool</th>
						<th>Description</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>
							<code>bash</code>
						</td>
						<td>Execute shell commands. Returns stdout, stderr, exit code.</td>
					</tr>
					<tr>
						<td>
							<code>terminal</code>
						</td>
						<td>Persistent terminal sessions via bun-pty.</td>
					</tr>
				</tbody>
			</table>

			<h3>Git</h3>
			<table>
				<thead>
					<tr>
						<th>Tool</th>
						<th>Description</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>
							<code>git_status</code>
						</td>
						<td>Git working tree status.</td>
					</tr>
					<tr>
						<td>
							<code>git_diff</code>
						</td>
						<td>Git diff (staged or all changes).</td>
					</tr>
					<tr>
						<td>
							<code>git_commit</code>
						</td>
						<td>Create a git commit.</td>
					</tr>
				</tbody>
			</table>

			<h2>Agent Configuration</h2>

			<h3>Per-Project</h3>
			<p>
				Create <code>.otto/agents.json</code> in your project root:
			</p>
			<CodeBlock>{`{
  "build": {
    "tools": ["read", "write", "bash", "git_status", "ripgrep"],
    "prompt": ".otto/agents/build/agent.md"
  },
  "custom-agent": {
    "tools": ["read", "ls", "tree", "ripgrep"],
    "prompt": ".otto/agents/custom-agent/agent.md"
  }
}`}</CodeBlock>

			<h3>Options</h3>
			<table>
				<thead>
					<tr>
						<th>Field</th>
						<th>Description</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>
							<code>tools</code>
						</td>
						<td>Override the default tool list.</td>
					</tr>
					<tr>
						<td>
							<code>appendTools</code>
						</td>
						<td>Add tools to the default list.</td>
					</tr>
					<tr>
						<td>
							<code>prompt</code>
						</td>
						<td>Path to a custom system prompt file.</td>
					</tr>
					<tr>
						<td>
							<code>provider</code>
						</td>
						<td>Override provider for this agent.</td>
					</tr>
					<tr>
						<td>
							<code>model</code>
						</td>
						<td>Override model for this agent.</td>
					</tr>
				</tbody>
			</table>

			<h2>Custom Tools</h2>
			<p>
				Add project-specific tools in <code>.otto/tools/</code>:
			</p>
			<CodeBlock>{`// .otto/tools/deploy.ts
import { tool } from "@ottocode/sdk";
import { z } from "zod";

export default tool({
  name: "deploy",
  description: "Deploy the application",
  parameters: z.object({
    environment: z.enum(["staging", "production"]),
  }),
  execute: async ({ environment }) => {
    return { success: true, environment };
  },
});`}</CodeBlock>

			<h2>Skills</h2>
			<p>
				Skills are markdown files that provide specialized instructions to
				agents, loaded via the <code>skill</code> tool.
			</p>
			<p>Defined at three levels:</p>
			<ul>
				<li>
					<strong>Project:</strong> <code>.otto/skills/</code>
				</li>
				<li>
					<strong>Global:</strong> <code>~/.config/otto/skills/</code>
				</li>
				<li>
					<strong>Built-in:</strong> bundled with otto
				</li>
			</ul>
			<CodeBlock>{`otto skills                    # list available skills`}</CodeBlock>
		</div>
	);
}
