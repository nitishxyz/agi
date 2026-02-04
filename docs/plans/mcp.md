# MCP (Model Context Protocol) Feature Plan

## Overview

MCP is an open standard from Anthropic for connecting AI agents to external tools and data sources. It provides a standardized way for agents to interact with databases, APIs, file systems, and other services.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        otto agent                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   MCP Client                          │  │
│  │  • Discovers servers from config                      │  │
│  │  • Manages server lifecycle                           │  │
│  │  • Routes tool calls to appropriate server            │  │
│  └────────────┬─────────────────────┬───────────────────┘  │
└───────────────┼─────────────────────┼───────────────────────┘
                │                     │
        ┌───────▼───────┐     ┌───────▼───────┐
        │  MCP Server   │     │  MCP Server   │
        │   (GitHub)    │     │   (Postgres)  │
        │               │     │               │
        │ stdio/SSE     │     │ stdio/SSE     │
        └───────────────┘     └───────────────┘
```

## MCP Primitives

| Primitive | Description | Example |
|-----------|-------------|---------|
| **Tools** | Actions the agent can take | `create_issue`, `query_database` |
| **Resources** | Data the agent can read | `file://`, `postgres://table` |
| **Prompts** | Reusable prompt templates | `summarize-pr`, `code-review` |

## Configuration

**`.otto/config.json`:**
```json
{
  "mcp": {
    "servers": [
      {
        "name": "github",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": {
          "GITHUB_TOKEN": "${GITHUB_TOKEN}"
        }
      },
      {
        "name": "postgres",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-postgres"],
        "env": {
          "DATABASE_URL": "${DATABASE_URL}"
        }
      },
      {
        "name": "filesystem",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/allowed/dir"]
      }
    ]
  }
}
```

**Global config (`~/.config/otto/config.json`):**
```json
{
  "mcp": {
    "servers": [
      {
        "name": "slack",
        "command": "npx",
        "args": ["-y", "@anthropic/mcp-server-slack"],
        "env": {
          "SLACK_BOT_TOKEN": "${SLACK_BOT_TOKEN}"
        }
      }
    ]
  }
}
```

## Implementation Plan

### Phase 1: MCP Types & Transport

**Files to create:**
```
packages/sdk/src/core/src/mcp/
├── index.ts              # Re-exports
├── types.ts              # MCP protocol types
├── transport/
│   ├── index.ts
│   ├── stdio.ts          # Stdio transport (local servers)
│   └── sse.ts            # SSE transport (remote servers)
├── client.ts             # MCP client implementation
├── server-manager.ts     # Lifecycle management
└── tools.ts              # Convert MCP tools to AI SDK tools
```

**`packages/sdk/src/core/src/mcp/types.ts`:**
```typescript
export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  disabled?: boolean;
}

export interface MCPConfig {
  servers: MCPServerConfig[];
}

// MCP Protocol Types
export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, JSONSchema>;
    required?: string[];
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPCapabilities {
  tools?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  prompts?: { listChanged?: boolean };
}

export type JSONSchema = {
  type?: string;
  description?: string;
  enum?: string[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
};
```

**`packages/sdk/src/core/src/mcp/transport/stdio.ts`:**
```typescript
import { spawn, ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

export class StdioTransport extends EventEmitter {
  private process: ChildProcess | null = null;
  private buffer = '';
  
  constructor(
    private command: string,
    private args: string[],
    private env: Record<string, string>,
    private cwd?: string,
  ) {
    super();
  }
  
  async start(): Promise<void> {
    this.process = spawn(this.command, this.args, {
      cwd: this.cwd,
      env: { ...process.env, ...this.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    this.process.stdout?.on('data', (chunk) => this.handleData(chunk));
    this.process.stderr?.on('data', (chunk) => this.emit('error', chunk.toString()));
    this.process.on('exit', (code) => this.emit('exit', code));
  }
  
  async send(message: object): Promise<void> {
    if (!this.process?.stdin) throw new Error('Transport not started');
    const json = JSON.stringify(message) + '\n';
    this.process.stdin.write(json);
  }
  
  async stop(): Promise<void> {
    this.process?.kill();
    this.process = null;
  }
  
  private handleData(chunk: Buffer): void {
    this.buffer += chunk.toString();
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const message = JSON.parse(line);
        this.emit('message', message);
      } catch {
        this.emit('error', `Invalid JSON: ${line}`);
      }
    }
  }
}
```

### Phase 2: MCP Client

**`packages/sdk/src/core/src/mcp/client.ts`:**
```typescript
import { EventEmitter } from 'node:events';
import { StdioTransport } from './transport/stdio';
import type { MCPServerConfig, MCPTool, MCPResource, MCPCapabilities } from './types';

export class MCPClient extends EventEmitter {
  private transport: StdioTransport | null = null;
  private requestId = 0;
  private pending = new Map<number, { resolve: Function; reject: Function }>();
  
  constructor(private config: MCPServerConfig) {
    super();
  }
  
  async connect(): Promise<MCPCapabilities> {
    const env = this.resolveEnv(this.config.env ?? {});
    this.transport = new StdioTransport(
      this.config.command,
      this.config.args ?? [],
      env,
      this.config.cwd,
    );
    
    this.transport.on('message', (msg) => this.handleMessage(msg));
    this.transport.on('error', (err) => this.emit('error', err));
    
    await this.transport.start();
    
    // Initialize connection
    const result = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'ottocode', version: '1.0.0' },
    });
    
    await this.notify('notifications/initialized', {});
    
    return result.capabilities;
  }
  
  async listTools(): Promise<MCPTool[]> {
    const result = await this.request('tools/list', {});
    return result.tools ?? [];
  }
  
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const result = await this.request('tools/call', { name, arguments: args });
    return result.content;
  }
  
  async listResources(): Promise<MCPResource[]> {
    const result = await this.request('resources/list', {});
    return result.resources ?? [];
  }
  
  async readResource(uri: string): Promise<{ contents: Array<{ uri: string; text?: string; blob?: string }> }> {
    return this.request('resources/read', { uri });
  }
  
  async disconnect(): Promise<void> {
    await this.transport?.stop();
    this.transport = null;
  }
  
  private async request(method: string, params: object): Promise<any> {
    const id = ++this.requestId;
    
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.transport?.send({ jsonrpc: '2.0', id, method, params });
      
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
    });
  }
  
  private async notify(method: string, params: object): Promise<void> {
    await this.transport?.send({ jsonrpc: '2.0', method, params });
  }
  
  private handleMessage(msg: any): void {
    if (msg.id && this.pending.has(msg.id)) {
      const { resolve, reject } = this.pending.get(msg.id)!;
      this.pending.delete(msg.id);
      
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  }
  
  private resolveEnv(env: Record<string, string>): Record<string, string> {
    const resolved: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
      resolved[key] = value.replace(/\$\{(\w+)\}/g, (_, name) => process.env[name] ?? '');
    }
    return resolved;
  }
}
```

### Phase 3: Server Manager

**`packages/sdk/src/core/src/mcp/server-manager.ts`:**
```typescript
import { MCPClient } from './client';
import type { MCPServerConfig, MCPTool } from './types';

export class MCPServerManager {
  private clients = new Map<string, MCPClient>();
  private toolsMap = new Map<string, { server: string; tool: MCPTool }>();
  
  async startServers(configs: MCPServerConfig[]): Promise<void> {
    for (const config of configs) {
      if (config.disabled) continue;
      
      try {
        const client = new MCPClient(config);
        await client.connect();
        this.clients.set(config.name, client);
        
        // Index tools by name
        const tools = await client.listTools();
        for (const tool of tools) {
          const fullName = `${config.name}__${tool.name}`;
          this.toolsMap.set(fullName, { server: config.name, tool });
        }
      } catch (err) {
        console.error(`Failed to start MCP server ${config.name}:`, err);
      }
    }
  }
  
  async stopAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.disconnect();
    }
    this.clients.clear();
    this.toolsMap.clear();
  }
  
  getTools(): Array<{ name: string; server: string; tool: MCPTool }> {
    return Array.from(this.toolsMap.entries()).map(([name, { server, tool }]) => ({
      name,
      server,
      tool,
    }));
  }
  
  async callTool(fullName: string, args: Record<string, unknown>): Promise<unknown> {
    const entry = this.toolsMap.get(fullName);
    if (!entry) throw new Error(`Unknown MCP tool: ${fullName}`);
    
    const client = this.clients.get(entry.server);
    if (!client) throw new Error(`MCP server not connected: ${entry.server}`);
    
    return client.callTool(entry.tool.name, args);
  }
}
```

### Phase 4: Convert to AI SDK Tools

**`packages/sdk/src/core/src/mcp/tools.ts`:**
```typescript
import { tool, type Tool } from 'ai';
import { z } from 'zod';
import type { MCPServerManager } from './server-manager';
import type { MCPTool, JSONSchema } from './types';

export function convertMCPToolsToAISDK(
  manager: MCPServerManager,
): Array<{ name: string; tool: Tool }> {
  const mcpTools = manager.getTools();
  
  return mcpTools.map(({ name, tool: mcpTool }) => ({
    name,
    tool: tool({
      description: mcpTool.description ?? `MCP tool: ${mcpTool.name}`,
      parameters: jsonSchemaToZod(mcpTool.inputSchema),
      execute: async (args) => {
        try {
          const result = await manager.callTool(name, args as Record<string, unknown>);
          return { ok: true, result };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      },
    }),
  }));
}

function jsonSchemaToZod(schema: JSONSchema['properties'] extends infer T ? { properties?: T } : never): z.ZodTypeAny {
  if (!schema.properties) return z.object({});
  
  const shape: Record<string, z.ZodTypeAny> = {};
  const required = new Set(schema.required ?? []);
  
  for (const [key, prop] of Object.entries(schema.properties ?? {})) {
    let field = convertProperty(prop);
    if (!required.has(key)) field = field.optional();
    shape[key] = field;
  }
  
  return z.object(shape);
}

function convertProperty(prop: JSONSchema): z.ZodTypeAny {
  if (prop.enum) {
    return z.enum(prop.enum as [string, ...string[]]);
  }
  
  switch (prop.type) {
    case 'string': return prop.description ? z.string().describe(prop.description) : z.string();
    case 'number': return z.number();
    case 'integer': return z.number().int();
    case 'boolean': return z.boolean();
    case 'array': return z.array(prop.items ? convertProperty(prop.items) : z.unknown());
    case 'object': return jsonSchemaToZod(prop);
    default: return z.unknown();
  }
}
```

### Phase 5: Integration with Tool Loader

**Modify `packages/sdk/src/core/src/tools/loader.ts`:**

```typescript
import { MCPServerManager } from '../mcp/server-manager';
import { convertMCPToolsToAISDK } from '../mcp/tools';

let globalMCPManager: MCPServerManager | null = null;

export async function initializeMCP(config: MCPConfig): Promise<void> {
  if (globalMCPManager) await globalMCPManager.stopAll();
  globalMCPManager = new MCPServerManager();
  await globalMCPManager.startServers(config.servers);
}

export async function discoverProjectTools(
  projectRoot: string,
  globalConfigDir?: string,
): Promise<DiscoveredTool[]> {
  // ... existing code ...
  
  // Add MCP tools
  if (globalMCPManager) {
    const mcpTools = convertMCPToolsToAISDK(globalMCPManager);
    for (const { name, tool } of mcpTools) {
      tools.set(name, tool);
    }
  }
  
  // ... rest of function ...
}
```

### Phase 6: CLI Commands

**Add `otto mcp` command:**
```
otto mcp list                 # List configured servers
otto mcp status               # Show running servers and tools
otto mcp add <name>           # Interactive server setup
otto mcp remove <name>        # Remove server from config
otto mcp test <name>          # Test server connection
```

## File Structure After Implementation

```
packages/sdk/src/core/src/
├── mcp/
│   ├── index.ts
│   ├── types.ts
│   ├── transport/
│   │   ├── index.ts
│   │   ├── stdio.ts
│   │   └── sse.ts
│   ├── client.ts
│   ├── server-manager.ts
│   └── tools.ts
├── tools/
│   └── loader.ts           # Modified
└── index.ts                # Add MCP exports

apps/cli/src/
└── mcp.ts                  # CLI commands
```

## Popular MCP Servers

| Server | Package | Use Case |
|--------|---------|----------|
| GitHub | `@modelcontextprotocol/server-github` | Issues, PRs, repos |
| Postgres | `@modelcontextprotocol/server-postgres` | Database queries |
| Filesystem | `@modelcontextprotocol/server-filesystem` | File operations |
| Slack | `@anthropic/mcp-server-slack` | Messages, channels |
| Google Drive | `@anthropic/mcp-server-gdrive` | Docs, sheets |
| Brave Search | `@anthropic/mcp-server-brave-search` | Web search |
| Memory | `@anthropic/mcp-server-memory` | Knowledge graph |

## Security Considerations

1. **Environment variables:** Use `${VAR}` syntax, never hardcode secrets
2. **Sandboxing:** Consider running servers in containers for isolation
3. **Permissions:** Add allowlist for which tools agents can use
4. **Audit logging:** Log all MCP tool invocations

**Permission config:**
```json
{
  "mcp": {
    "permissions": {
      "github__create_issue": "allow",
      "postgres__*": "ask",
      "filesystem__write_file": "deny"
    }
  }
}
```

## Testing Plan

1. **Unit tests:**
   - `tests/mcp-transport.test.ts` - Stdio transport
   - `tests/mcp-client.test.ts` - Protocol messages
   - `tests/mcp-tools.test.ts` - Tool conversion

2. **Integration tests:**
   - Mock MCP server
   - Test tool discovery and execution
   - Test server lifecycle

## Timeline

| Phase | Effort | Description |
|-------|--------|-------------|
| 1 | 2 days | Types & stdio transport |
| 2 | 2 days | MCP client implementation |
| 3 | 1 day | Server manager |
| 4 | 1 day | AI SDK tool conversion |
| 5 | 0.5 day | Integration with loader |
| 6 | 1 day | CLI commands |

**Total: ~7.5 days**

## Dependencies

Add to `packages/sdk/package.json`:
```json
{
  "dependencies": {
    "yaml": "^2.3.0"
  }
}
```

No external MCP SDK needed - we implement the protocol directly for minimal dependencies.

## Future Enhancements

1. **SSE transport:** For remote MCP servers
2. **Resource subscriptions:** Real-time updates from resources
3. **Prompt templates:** Load and use MCP prompts
4. **Tool search:** Search across all MCP servers for relevant tools
5. **Server marketplace:** Browse and install community servers
