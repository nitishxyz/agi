import { CodeBlock } from '../../components/CodeBlock';
import { DocPage } from '../../components/DocPage';

export function Sharing() {
	return (
		<DocPage>
			<h1 className="text-3xl font-bold mb-2">Session Sharing</h1>
			<p className="text-otto-dim text-sm mb-8">
				Share coding sessions as public read-only links.
			</p>

			<h2>Overview</h2>
			<p>
				Otto lets you turn any local session into a publicly viewable link.
				Messages, tool calls, code diffs, and token stats are all preserved in
				the shared view.
			</p>

			<h2>Quick Start</h2>
			<CodeBlock>{`otto share                     # pick a session interactively
otto share <session-id>        # share a specific session
otto share --title "Auth refactor" --description "Rewrote JWT flow"`}</CodeBlock>

			<h2>Commands</h2>

			<h3>Create a share</h3>
			<CodeBlock>{`otto share`}</CodeBlock>
			<p>
				Opens an interactive picker showing your 20 most recent sessions. Select
				one to upload it and receive a public URL.
			</p>

			<h3>Update an existing share</h3>
			<CodeBlock>{`otto share <session-id> --update`}</CodeBlock>
			<p>
				Syncs new messages added since the last share or update. The public URL
				stays the same.
			</p>

			<h3>Scope what you share</h3>
			<CodeBlock>{`otto share <session-id> --until <message-id>`}</CodeBlock>
			<p>Only share messages up to a specific point in the conversation.</p>

			<h3>Check status</h3>
			<CodeBlock>{`otto share <session-id> --status`}</CodeBlock>
			<p>
				Shows the share URL, synced message count, and whether new messages are
				waiting to be synced.
			</p>

			<h3>List all shares</h3>
			<CodeBlock>{`otto share --list`}</CodeBlock>

			<h3>Delete a share</h3>
			<CodeBlock>{`otto share <session-id> --delete`}</CodeBlock>
			<p>
				Removes the shared session from the public server and deletes the local
				share record.
			</p>

			<h2>What gets shared</h2>
			<ul>
				<li>Session metadata (title, agent, provider, model)</li>
				<li>All messages with their parts (text, tool calls, tool results)</li>
				<li>Token usage statistics</li>
				<li>Tool execution counts and timing</li>
			</ul>

			<h2>Example</h2>
			<p>
				See a live shared session to understand what the public view looks like:
			</p>
			<p>
				<a
					href="https://share.ottocode.io/s/cjqwnr6mPsPIUAjG79daV"
					target="_blank"
					rel="noopener noreferrer"
					className="text-otto-text underline underline-offset-4 hover:text-otto-muted transition-colors"
				>
					View example session →
				</a>
			</p>
		</DocPage>
	);
}
