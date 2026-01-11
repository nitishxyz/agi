/**
 * Test script to send a request that exactly mirrors Claude Code's format.
 *
 * Usage:
 *   bun run scripts/test-claude-spoof.ts
 *
 * This script:
 * 1. Reads the OAuth token from AGI's auth storage
 * 2. Sends a request with EXACT Claude Code headers, tools, and body structure
 * 3. Reports success or failure
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CLAUDE_CODE_VERSION = '2.1.2';
const TOKEN_ENDPOINT = 'https://console.anthropic.com/v1/oauth/token';
const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';

interface OAuthData {
  type: 'oauth';
  access: string;
  refresh: string;
  expires: number;
}

// Refresh the OAuth token
async function refreshToken(refreshToken: string): Promise<{ access: string; refresh: string; expires: number }> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = await response.json();
  return {
    access: data.access_token,
    refresh: data.refresh_token,
    expires: Date.now() + data.expires_in * 1000,
  };
}

// Read OAuth token from AGI's auth storage
async function getOAuthToken(): Promise<string | null> {
  const authPaths = [
    join(homedir(), 'Library', 'Application Support', 'agi', 'auth.json'),
    join(process.cwd(), '.agi', 'auth.json'),
    join(homedir(), '.config', 'agi', 'auth.json'),
  ];

  for (const authPath of authPaths) {
    if (existsSync(authPath)) {
      try {
        const authData = JSON.parse(readFileSync(authPath, 'utf-8'));
        if (authData.anthropic?.type === 'oauth') {
          const oauth = authData.anthropic as OAuthData;

          // Check if token is expired
          if (oauth.expires < Date.now()) {
            console.log('Token expired, refreshing...');
            try {
              const newTokens = await refreshToken(oauth.refresh);
              // Update the auth file
              authData.anthropic = {
                type: 'oauth',
                access: newTokens.access,
                refresh: newTokens.refresh,
                expires: newTokens.expires,
              };
              writeFileSync(authPath, JSON.stringify(authData, null, 2));
              console.log('✓ Token refreshed');
              return newTokens.access;
            } catch (e) {
              console.error('Failed to refresh token:', e);
              return null;
            }
          }

          return oauth.access;
        }
      } catch (e) {
        // Continue to next path
      }
    }
  }
  return null;
}

// Exact Claude Code tools (simplified set for testing)
const CLAUDE_CODE_TOOLS = [
  {
    name: 'Bash',
    description:
      'Executes a given bash command in a persistent shell session with optional timeout, ensuring proper handling and security measures.\n\nBefore executing the command, please follow these steps:\n\n1. Directory Verification:\n   - If the command will create new directories or files, first use `ls` to verify the parent directory exists and is the correct location\n\n2. Command Execution:\n   - Always quote file paths that contain spaces with double quotes\n   - After ensuring proper quoting, execute the command.\n   - Capture the output of the command.\n\nUsage notes:\n  - The command argument is required.\n  - You can specify an optional timeout in milliseconds (up to 600000ms / 10 minutes).',
    input_schema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        command: {
          description: 'The command to execute',
          type: 'string',
        },
        timeout: {
          description: 'Optional timeout in milliseconds (max 600000)',
          type: 'number',
        },
      },
      required: ['command'],
      additionalProperties: false,
    },
  },
  {
    name: 'Glob',
    description:
      '- Fast file pattern matching tool that works with any codebase size\n- Supports glob patterns like "**/*.js" or "src/**/*.ts"\n- Returns matching file paths sorted by modification time\n- Use this tool when you need to find files by name patterns',
    input_schema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        pattern: {
          description: 'The glob pattern to match files against',
          type: 'string',
        },
        path: {
          description: 'The directory to search in.',
          type: 'string',
        },
      },
      required: ['pattern'],
      additionalProperties: false,
    },
  },
  {
    name: 'Grep',
    description:
      'A powerful search tool built on ripgrep\n\n  Usage:\n  - ALWAYS use Grep for search tasks.\n  - Supports full regex syntax\n  - Filter files with glob parameter or type parameter',
    input_schema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        pattern: {
          description: 'The regular expression pattern to search for in file contents',
          type: 'string',
        },
        path: {
          description: 'File or directory to search in. Defaults to current working directory.',
          type: 'string',
        },
      },
      required: ['pattern'],
      additionalProperties: false,
    },
  },
  {
    name: 'Read',
    description:
      'Reads a file from the local filesystem. You can access any file directly by using this tool.\nAssume this tool is able to read all files on the machine.',
    input_schema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {
        file_path: {
          description: 'The absolute path to the file to read',
          type: 'string',
        },
        offset: {
          description: 'The line number to start reading from.',
          type: 'number',
        },
        limit: {
          description: 'The number of lines to read.',
          type: 'number',
        },
      },
      required: ['file_path'],
      additionalProperties: false,
    },
  },
];

// Generate stable IDs
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function generateUserHash(token: string): string {
  let hash = 0;
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(64, '0').slice(0, 64);
}

async function main() {
  console.log('=== Claude Code Spoof Test ===\n');

  // Get auth token
  const accessToken = await getOAuthToken();

  if (!accessToken) {
    console.error('No OAuth token found. Run: agi auth login anthropic --oauth');
    process.exit(1);
  }

  console.log('✓ Found OAuth token');

  // Generate IDs
  const userHash = generateUserHash(accessToken);
  const accountUUID = generateUUID();
  const sessionId = generateUUID();

  // Build exact Claude Code request
  const requestBody = {
    model: 'claude-sonnet-4-20250514', // Use a model that's definitely available
    max_tokens: 1024,
    system: [
      {
        type: 'text',
        text: "You are Claude Code, Anthropic's official CLI for Claude.",
        cache_control: { type: 'ephemeral' },
      },
      {
        type: 'text',
        text: "You are an interactive CLI tool that helps users with software engineering tasks. Use the instructions below and the tools available to you to assist the user.\n\nHere is useful information about the environment you are running in:\n<env>\nWorking directory: /Users/bat/dev/slashforge/agi\nIs directory a git repo: Yes\nPlatform: darwin\nToday's date: 2026-01-09\n</env>",
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Say hello',
            cache_control: { type: 'ephemeral' },
          },
        ],
      },
    ],
    tools: CLAUDE_CODE_TOOLS,
    stream: true,
    metadata: {
      user_id: `user_${userHash}_account_${accountUUID}_session_${sessionId}`,
    },
  };

  // Build exact Claude Code headers
  const headers: Record<string, string> = {
    accept: 'application/json',
    'anthropic-beta':
      'claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14',
    'anthropic-dangerous-direct-browser-access': 'true',
    'anthropic-version': '2023-06-01',
    authorization: `Bearer ${accessToken}`,
    'content-type': 'application/json',
    'user-agent': `claude-cli/${CLAUDE_CODE_VERSION} (external, cli)`,
    'x-app': 'cli',
    'x-stainless-arch': process.arch === 'arm64' ? 'arm64' : 'x64',
    'x-stainless-helper-method': 'stream',
    'x-stainless-lang': 'js',
    'x-stainless-os': 'MacOS',
    'x-stainless-package-version': '0.70.0',
    'x-stainless-retry-count': '0',
    'x-stainless-runtime': 'node',
    'x-stainless-runtime-version': process.version,
    'x-stainless-timeout': '600',
  };

  console.log('\n--- Request Details ---');
  console.log('URL: https://api.anthropic.com/v1/messages?beta=true');
  console.log('Headers:', JSON.stringify(headers, null, 2));
  console.log('\nBody preview:');
  console.log('  model:', requestBody.model);
  console.log('  tools:', requestBody.tools.map((t) => t.name).join(', '));
  console.log('  system blocks:', requestBody.system.length);
  console.log('  cache_control blocks: 3 (2 system + 1 message)');
  console.log('  message:', requestBody.messages[0].content[0].text);
  console.log('  metadata.user_id:', requestBody.metadata.user_id.slice(0, 40) + '...');

  console.log('\n--- Sending Request ---\n');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages?beta=true', {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    console.log('Status:', response.status, response.statusText);
    console.log('\nResponse Headers:');
    response.headers.forEach((value, key) => {
      if (
        key.startsWith('anthropic') ||
        key === 'x-should-retry' ||
        key === 'request-id'
      ) {
        console.log(`  ${key}: ${value}`);
      }
    });

    if (response.ok) {
      console.log('\n✓ SUCCESS! Request was accepted.');

      // Read and parse streaming response
      const reader = response.body?.getReader();
      if (reader) {
        console.log('\n--- Response Stream ---\n');
        const decoder = new TextDecoder();
        let buffer = '';
        let assistantText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const event = JSON.parse(data);

                switch (event.type) {
                  case 'message_start':
                    console.log(`[message_start] model=${event.message.model} id=${event.message.id}`);
                    console.log(`  input_tokens=${event.message.usage.input_tokens} cache_read=${event.message.usage.cache_read_input_tokens}`);
                    break;

                  case 'content_block_start':
                    if (event.content_block?.type === 'thinking') {
                      console.log(`\n[thinking] index=${event.index}`);
                    } else if (event.content_block?.type === 'text') {
                      console.log(`\n[text] index=${event.index}`);
                    } else if (event.content_block?.type === 'tool_use') {
                      console.log(`\n[tool_use] ${event.content_block.name} id=${event.content_block.id}`);
                    }
                    break;

                  case 'content_block_delta':
                    if (event.delta?.type === 'thinking_delta') {
                      process.stdout.write(event.delta.thinking);
                    } else if (event.delta?.type === 'text_delta') {
                      process.stdout.write(event.delta.text);
                      assistantText += event.delta.text;
                    } else if (event.delta?.type === 'input_json_delta') {
                      process.stdout.write(event.delta.partial_json);
                    }
                    break;

                  case 'content_block_stop':
                    console.log('');
                    break;

                  case 'message_delta':
                    console.log(`\n[message_delta] stop_reason=${event.delta.stop_reason} output_tokens=${event.usage.output_tokens}`);
                    break;

                  case 'message_stop':
                    console.log('[message_stop]');
                    break;
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
        console.log('\n--- End of Stream ---');
        if (assistantText) {
          console.log('\n=== Assistant Response ===');
          console.log(assistantText);
        }
      }
    } else {
      console.log('\n✗ FAILED');
      const errorBody = await response.text();
      console.log('\nError Response:');
      try {
        console.log(JSON.stringify(JSON.parse(errorBody), null, 2));
      } catch {
        console.log(errorBody);
      }
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}

main();
