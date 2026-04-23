import { CodeBlock } from '../../components/CodeBlock';
import { DocPage } from '../../components/DocPage';

export function AgentsTools() {
	return (
		<DocPage>
			<h1 className="text-3xl font-bold mb-2">Agents & Tools</h1>
			<p className="text-otto-dim text-sm mb-8">
				Built-in agents, current toolsets, MCP tools, and customization.
			</p>

			<h2>Built-in agents</h2>
			<p>
				otto currently ships with four built-in agents: <code>build</code>,{' '}
				<code>plan</code>, <code>general</code>, and <code>research</code>.
			</p>
			<p>
				All built-in agents also receive <code>progress_update</code>,{' '}
				<code>finish</code>, and <code>skill</code>.
			</p>

			<h3>build</h3>
			<p>Implementation agent for code changes and fixes.</p>
			<p>
				<strong>Tools:</strong> read, write, ls, tree, shell, update_todos,
				glob, ripgrep, git_status, terminal, apply_patch, websearch
			</p>
			<CodeBlock>{`otto "create an auth component" --agent build
otto "fix the failing test" --agent build`}</CodeBlock>

			<h3>plan</h3>
			<p>Planning and analysis agent.</p>
			<p>
				<strong>Tools:</strong> read, ls, tree, ripgrep, update_todos, websearch
			</p>
			<CodeBlock>{`otto "design the API architecture" --agent plan
otto "review the dependency graph" --agent plan`}</CodeBlock>

			<h3>general</h3>
			<p>Broad mixed-purpose assistant.</p>
			<p>
				<strong>Tools:</strong> read, write, ls, tree, shell, ripgrep, glob,
				websearch, update_todos
			</p>
			<CodeBlock>{`otto "explain how this module works" --agent general`}</CodeBlock>

			<h3>research</h3>
			<p>
				Research-oriented agent that can inspect prior sessions and related
				context.
			</p>
			<p>
				<strong>Tools:</strong> read, ls, tree, ripgrep, websearch,
				update_todos, query_sessions, query_messages, get_session_context,
				search_history, get_parent_session, present_action
			</p>
			<CodeBlock>{`otto "research how auth is implemented" --agent research`}</CodeBlock>

			<h2>Built-in tools</h2>
			<p>
				The lists below describe the overall built-in tool universe. Each agent
				only receives the subset assigned to its preset or config overrides.
			</p>

			<h3>File system</h3>
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
						<td>Read file contents, optionally by line range.</td>
					</tr>
					<tr>
						<td>
							<code>write</code>
						</td>
						<td>Write or create a file.</td>
					</tr>
					<tr>
						<td>
							<code>ls</code>
						</td>
						<td>List a directory.</td>
					</tr>
					<tr>
						<td>
							<code>tree</code>
						</td>
						<td>Render a directory tree.</td>
					</tr>
					<tr>
						<td>
							<code>pwd</code>
						</td>
						<td>Return the current working directory.</td>
					</tr>
					<tr>
						<td>
							<code>cd</code>
						</td>
						<td>Change the working directory for the tool runtime.</td>
					</tr>
					<tr>
						<td>
							<code>glob</code>
						</td>
						<td>Find files by glob pattern.</td>
					</tr>
				</tbody>
			</table>

			<h3>Search and web</h3>
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
							<code>ripgrep</code>
						</td>
						<td>Fast regex/code search.</td>
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
							<code>apply_patch</code>
						</td>
						<td>Apply enveloped or unified diff patches.</td>
					</tr>
				</tbody>
			</table>

			<h3>Shell and runtime</h3>
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
							<code>shell</code>
						</td>
						<td>Execute shell commands.</td>
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
						<td>Git diff.</td>
					</tr>
					<tr>
						<td>
							<code>git_commit</code>
						</td>
						<td>Create a git commit.</td>
					</tr>
				</tbody>
			</table>

			<h3>Agent control and research</h3>
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
							<code>update_todos</code>
						</td>
						<td>Track a visible task list.</td>
					</tr>
					<tr>
						<td>
							<code>progress_update</code>
						</td>
						<td>Emit short status/progress updates.</td>
					</tr>
					<tr>
						<td>
							<code>finish</code>
						</td>
						<td>Signal task completion.</td>
					</tr>
					<tr>
						<td>
							<code>skill</code>
						</td>
						<td>Load specialized instructions from a skill bundle.</td>
					</tr>
					<tr>
						<td>
							<code>query_sessions</code>
						</td>
						<td>Search sessions.</td>
					</tr>
					<tr>
						<td>
							<code>query_messages</code>
						</td>
						<td>Search messages.</td>
					</tr>
					<tr>
						<td>
							<code>get_session_context</code>
						</td>
						<td>Load a session context snapshot.</td>
					</tr>
					<tr>
						<td>
							<code>search_history</code>
						</td>
						<td>Search historical activity.</td>
					</tr>
					<tr>
						<td>
							<code>get_parent_session</code>
						</td>
						<td>Resolve parent session linkage.</td>
					</tr>
					<tr>
						<td>
							<code>present_action</code>
						</td>
						<td>Present research findings/action links.</td>
					</tr>
				</tbody>
			</table>

			<h2>Agent Configuration</h2>
			<p>
				Use <code>.otto/agents.json</code> or{' '}
				<code>~/.config/otto/agents.json</code>.
			</p>
			<CodeBlock>{`{
  "build": {
    "appendTools": ["git_diff", "glob"]
  },
  "reviewer": {
    "tools": ["read", "ls", "tree", "ripgrep", "update_todos"],
    "prompt": ".otto/agents/reviewer.md"
  }
}`}</CodeBlock>
			<p>
				Prompt files are typically stored at{' '}
				<code>.otto/agents/{'{name}'}.md</code> or{' '}
				<code>.otto/agents/{'{name}'}.txt</code>.
			</p>

			<h2>Custom Tools</h2>
			<p>
				Custom tools are discovered from plugin folders like{' '}
				<code>.otto/tools/{'{tool-name}'}/tool.js</code> and{' '}
				<code>tool.mjs</code>.
			</p>
			<CodeBlock>{`export default {
  name: 'file_size',
  description: 'Return the byte size for a file path',
  parameters: {
    path: {
      type: 'string',
      description: 'Path to inspect'
    }
  },
  async execute({ input, fs }) {
    const content = await fs.readFile(input.path, 'utf8');
    return { bytes: Buffer.byteLength(content, 'utf8') };
  }
};`}</CodeBlock>

			<h2>MCP Tools</h2>
			<p>
				Running MCP servers expose tools named like <code>server__tool</code>.
				Those tools come from the connected server and are separate from the
				built-in agent presets.
			</p>
			<ul>
				<li>
					<code>github__create_issue</code>
				</li>
				<li>
					<code>linear__list_issues</code>
				</li>
				<li>
					<code>helius__getBalance</code>
				</li>
			</ul>

			<h2>Skills</h2>
			<p>
				The <code>skill</code> tool loads markdown instruction bundles on
				demand.
			</p>
			<ul>
				<li>
					<strong>Built-in</strong> bundled skills
				</li>
				<li>
					<strong>Project</strong>: <code>.otto/skills/</code> or{' '}
					<code>.agents/skills/</code>
				</li>
				<li>
					<strong>Global</strong>: <code>~/.config/otto/skills/</code> or{' '}
					<code>~/.agents/skills/</code>
				</li>
				<li>
					<strong>Compatibility</strong>: <code>.agenst/skills/</code> or{' '}
					<code>~/.agenst/skills/</code>
				</li>
			</ul>
			<CodeBlock>{`otto skills                    # list available skills`}</CodeBlock>
		</DocPage>
	);
}
