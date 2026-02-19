import { CodeBlock } from '../../components/CodeBlock';
import { DocPage } from '../../components/DocPage';
export function AiSdkCaching() {
	return (
		<DocPage>
			<h1 className="text-3xl font-bold mb-2">Caching</h1>
			<p className="text-otto-dim text-sm mb-8">
				Anthropic prompt caching and Setu server-side caching in{' '}
				<code>@ottocode/ai-sdk</code>.
			</p>

			<h2>Anthropic Cache Control</h2>
			<p>
				By default, the SDK automatically injects{' '}
				<code>{'cache_control: { type: "ephemeral" }'}</code> on the first
				system block and the last message for Anthropic models. This saves ~90%
				on cached token costs.
			</p>

			<CodeBlock>{`// Default: auto caching (1 system + 1 message breakpoint)
createSetu({ auth });

// Disable completely
createSetu({ auth, cache: { anthropicCaching: false } });

// Manual: SDK won't inject cache_control — set it yourself in messages
createSetu({ auth, cache: { anthropicCaching: { strategy: "manual" } } });

// Custom breakpoint count and placement
createSetu({
  auth,
  cache: {
    anthropicCaching: {
      systemBreakpoints: 2,       // cache first 2 system blocks
      systemPlacement: "first",   // "first" | "last" | "all"
      messageBreakpoints: 3,      // cache last 3 messages
      messagePlacement: "last",   // "first" | "last" | "all"
    },
  },
});

// Full custom transform
createSetu({
  auth,
  cache: {
    anthropicCaching: {
      strategy: "custom",
      transform: (body) => {
        // modify body however you want
        return body;
      },
    },
  },
});`}</CodeBlock>

			<h3>Options Reference</h3>
			<div className="overflow-x-auto">
				<table>
					<thead>
						<tr>
							<th>Option</th>
							<th>Default</th>
							<th>Description</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>
								<code>strategy</code>
							</td>
							<td>
								<code>"auto"</code>
							</td>
							<td>
								<code>"auto"</code>, <code>"manual"</code>,{' '}
								<code>"custom"</code>, or <code>false</code>
							</td>
						</tr>
						<tr>
							<td>
								<code>systemBreakpoints</code>
							</td>
							<td>
								<code>1</code>
							</td>
							<td>Number of system blocks to cache</td>
						</tr>
						<tr>
							<td>
								<code>messageBreakpoints</code>
							</td>
							<td>
								<code>1</code>
							</td>
							<td>Number of messages to cache</td>
						</tr>
						<tr>
							<td>
								<code>systemPlacement</code>
							</td>
							<td>
								<code>"first"</code>
							</td>
							<td>
								Which system blocks: <code>"first"</code>,{' '}
								<code>"last"</code>, <code>"all"</code>
							</td>
						</tr>
						<tr>
							<td>
								<code>messagePlacement</code>
							</td>
							<td>
								<code>"last"</code>
							</td>
							<td>
								Which messages: <code>"first"</code>, <code>"last"</code>,{' '}
								<code>"all"</code>
							</td>
						</tr>
						<tr>
							<td>
								<code>cacheType</code>
							</td>
							<td>
								<code>"ephemeral"</code>
							</td>
							<td>
								The <code>cache_control.type</code> value
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			<h2>Setu Server-Side Caching</h2>
			<p>Provider-agnostic caching at the Setu proxy layer:</p>
			<CodeBlock>{`createSetu({
  auth,
  cache: {
    promptCacheKey: "my-session-123",
    promptCacheRetention: "in_memory", // or "24h"
  },
});`}</CodeBlock>

			<h2>OpenAI / Google</h2>
			<ul>
				<li>
					<strong>OpenAI</strong>: Automatic server-side prefix caching — no
					configuration needed
				</li>
				<li>
					<strong>Google</strong>: Requires pre-uploaded{' '}
					<code>cachedContent</code> at the application level
				</li>
			</ul>
		</DocPage>
	);
}
