import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { walletAuth } from '../middleware/auth';
import { balanceCheck } from '../middleware/balance-check';
import { deductCost } from '../services/balance';
import { config } from '../config';
import type { UsageInfo } from '../types';
import { sanitizeProviderError } from '../utils/error-sanitizer';

type Variables = { walletAddress: string };

const messages = new Hono<{ Variables: Variables }>();

const API_VERSION = '2023-06-01';

function normalizeUsage(usage: any): UsageInfo | null {
  if (!usage) return null;
  return {
    inputTokens: usage.input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
    cachedInputTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
  };
}

async function handleMessages(c: Context<{ Variables: Variables }>) {
  const walletAddress = c.get('walletAddress');
  const body = await c.req.json();
  const model = body.model;

  if (!model || !model.startsWith('claude')) {
    return c.json({ error: 'This endpoint only supports Claude models' }, 400);
  }

  const isStream = Boolean(body.stream);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropic.apiKey,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    const sanitized = sanitizeProviderError(error, response.status);
    return c.json({ error: sanitized.message }, sanitized.status as ContentfulStatusCode);
  }

  if (isStream) {
    return stream(c, async (writer) => {
      const reader = response.body?.getReader();
      if (!reader) {
        await writer.write('event: error\ndata: {"error": "No response body"}\n\n');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let usage: UsageInfo | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          await writer.write(line + '\n');

          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5).trim());
              
              if (data.type === 'message_start' && data.message?.usage) {
                usage = normalizeUsage(data.message.usage);
              }
              
              if (data.type === 'message_delta' && data.usage) {
                const outputTokens = data.usage.output_tokens ?? 0;
                if (usage) {
                  usage.outputTokens = outputTokens;
                } else {
                  usage = { inputTokens: 0, outputTokens, cachedInputTokens: 0, cacheCreationInputTokens: 0 };
                }
              }
            } catch {}
          }
        }
      }

      if (usage) {
        const { cost, newBalance } = await deductCost(
          walletAddress,
          'anthropic',
          model,
          usage,
          config.markup,
        );
        
        const costData = {
          cost_usd: cost.toFixed(8),
          balance_remaining: newBalance.toFixed(8),
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
        };
        await writer.write(`: solforge ${JSON.stringify(costData)}\n`);
      }
    });
  }

  const json = await response.json();
  const usage = normalizeUsage(json.usage);

  if (usage) {
    const { cost, newBalance } = await deductCost(
      walletAddress,
      'anthropic',
      model,
      usage,
      config.markup,
    );

    return c.json(json, 200, {
      'x-balance-remaining': newBalance.toFixed(8),
      'x-cost-usd': cost.toFixed(8),
    });
  }

  return c.json(json);
}

messages.post('/v1/messages', walletAuth, balanceCheck, handleMessages);
messages.post('/messages', walletAuth, balanceCheck, handleMessages);

export default messages;
