import { providerIds } from '@agi-cli/sdk';

export const schemas = {
	Provider: {
		type: 'string',
		enum: providerIds,
	},
	AskResponse: {
		type: 'object',
		properties: {
			sessionId: { type: 'string' },
			header: { $ref: '#/components/schemas/AskResponseHeader' },
			provider: { $ref: '#/components/schemas/Provider' },
			model: { type: 'string' },
			agent: { type: 'string' },
			assistantMessageId: { type: 'string' },
			message: {
				$ref: '#/components/schemas/AskResponseMessage',
				nullable: true,
				description:
					'Present when the request created a new session or reused the last session for the project.',
			},
		},
		required: [
			'sessionId',
			'header',
			'provider',
			'model',
			'agent',
			'assistantMessageId',
		],
	},
	AskResponseHeader: {
		type: 'object',
		properties: {
			sessionId: { type: 'string' },
			agent: { type: 'string', nullable: true },
			provider: {
				$ref: '#/components/schemas/Provider',
				nullable: true,
			},
			model: { type: 'string', nullable: true },
		},
		required: ['sessionId'],
	},
	AskResponseMessage: {
		type: 'object',
		properties: {
			kind: { type: 'string', enum: ['created', 'last'] },
			sessionId: { type: 'string' },
		},
		required: ['kind', 'sessionId'],
	},
	Session: {
		type: 'object',
		properties: {
			id: { type: 'string' },
			title: { type: 'string', nullable: true },
			agent: { type: 'string' },
			provider: { $ref: '#/components/schemas/Provider' },
			model: { type: 'string' },
			projectPath: { type: 'string' },
			createdAt: { type: 'integer', format: 'int64' },
			lastActiveAt: { type: 'integer', format: 'int64', nullable: true },
			totalInputTokens: { type: 'integer', nullable: true },
			totalOutputTokens: { type: 'integer', nullable: true },
			totalToolTimeMs: { type: 'integer', nullable: true },
			toolCounts: {
				type: 'object',
				additionalProperties: { type: 'integer' },
				nullable: true,
			},
		},
		required: ['id', 'agent', 'provider', 'model', 'projectPath', 'createdAt'],
	},
	Message: {
		type: 'object',
		properties: {
			id: { type: 'string' },
			sessionId: { type: 'string' },
			role: {
				type: 'string',
				enum: ['system', 'user', 'assistant', 'tool'],
			},
			status: { type: 'string', enum: ['pending', 'complete', 'error'] },
			agent: { type: 'string' },
			provider: { $ref: '#/components/schemas/Provider' },
			model: { type: 'string' },
			createdAt: { type: 'integer', format: 'int64' },
			completedAt: { type: 'integer', format: 'int64', nullable: true },
			latencyMs: { type: 'integer', nullable: true },
			promptTokens: { type: 'integer', nullable: true },
			completionTokens: { type: 'integer', nullable: true },
			totalTokens: { type: 'integer', nullable: true },
			error: { type: 'string', nullable: true },
		},
		required: [
			'id',
			'sessionId',
			'role',
			'status',
			'agent',
			'provider',
			'model',
			'createdAt',
		],
	},
	MessagePart: {
		type: 'object',
		properties: {
			id: { type: 'string' },
			messageId: { type: 'string' },
			index: { type: 'integer', format: 'int64' },
			type: {
				type: 'string',
				enum: ['text', 'tool_call', 'tool_result', 'image', 'error'],
			},
			content: {
				type: 'string',
				description:
					'JSON-encoded content. For text: {"text": string}. For tool_call: {"name": string, "args": object}. For tool_result: {"name": string, "result"?: any, "artifact"?: Artifact}.',
			},
			agent: { type: 'string' },
			provider: { $ref: '#/components/schemas/Provider' },
			model: { type: 'string' },
			startedAt: { type: 'integer', format: 'int64', nullable: true },
			completedAt: { type: 'integer', format: 'int64', nullable: true },
			toolName: { type: 'string', nullable: true },
			toolCallId: { type: 'string', nullable: true },
			toolDurationMs: { type: 'integer', nullable: true },
		},
		required: [
			'id',
			'messageId',
			'index',
			'type',
			'content',
			'agent',
			'provider',
			'model',
		],
	},
	Artifact: {
		oneOf: [
			{ $ref: '#/components/schemas/FileDiffArtifact' },
			{ $ref: '#/components/schemas/FileArtifact' },
		],
	},
	FileDiffArtifact: {
		type: 'object',
		properties: {
			kind: { type: 'string', enum: ['file_diff'] },
			patchFormat: { type: 'string', enum: ['unified'] },
			patch: { type: 'string' },
			summary: {
				type: 'object',
				properties: {
					files: { type: 'integer' },
					additions: { type: 'integer' },
					deletions: { type: 'integer' },
				},
				additionalProperties: false,
			},
		},
		required: ['kind', 'patchFormat', 'patch'],
	},
	FileArtifact: {
		type: 'object',
		properties: {
			kind: { type: 'string', enum: ['file'] },
			path: { type: 'string' },
			mime: { type: 'string' },
			size: { type: 'integer' },
			sha256: { type: 'string' },
		},
		required: ['kind', 'path'],
	},
	Config: {
		type: 'object',
		properties: {
			agents: {
				type: 'array',
				items: { type: 'string' },
			},
			providers: {
				type: 'array',
				items: { $ref: '#/components/schemas/Provider' },
			},
			defaults: {
				type: 'object',
				properties: {
					agent: { type: 'string' },
					provider: { $ref: '#/components/schemas/Provider' },
					model: { type: 'string' },
				},
				required: ['agent', 'provider', 'model'],
			},
		},
		required: ['agents', 'providers', 'defaults'],
	},
	Model: {
		type: 'object',
		properties: {
			id: { type: 'string' },
			label: { type: 'string' },
			toolCall: { type: 'boolean' },
			reasoning: { type: 'boolean' },
		},
		required: ['id', 'label'],
	},
	GitStatus: {
		type: 'object',
		properties: {
			branch: { type: 'string' },
			ahead: { type: 'integer' },
			behind: { type: 'integer' },
			staged: {
				type: 'array',
				items: { $ref: '#/components/schemas/GitFile' },
			},
			unstaged: {
				type: 'array',
				items: { $ref: '#/components/schemas/GitFile' },
			},
			untracked: {
				type: 'array',
				items: { $ref: '#/components/schemas/GitFile' },
			},
			hasChanges: { type: 'boolean' },
		},
		required: [
			'branch',
			'ahead',
			'behind',
			'staged',
			'unstaged',
			'untracked',
			'hasChanges',
		],
	},
	GitFile: {
		type: 'object',
		properties: {
			path: { type: 'string' },
			status: {
				type: 'string',
				enum: ['modified', 'added', 'deleted', 'renamed', 'untracked'],
			},
			staged: { type: 'boolean' },
			insertions: { type: 'integer' },
			deletions: { type: 'integer' },
			oldPath: { type: 'string' },
		},
		required: ['path', 'status', 'staged'],
	},
	GitDiff: {
		type: 'object',
		properties: {
			file: { type: 'string' },
			diff: { type: 'string' },
			insertions: { type: 'integer' },
			deletions: { type: 'integer' },
			language: { type: 'string' },
			binary: { type: 'boolean' },
		},
		required: ['file', 'diff', 'insertions', 'deletions', 'language', 'binary'],
	},
	GitBranch: {
		type: 'object',
		properties: {
			current: { type: 'string' },
			upstream: { type: 'string' },
			ahead: { type: 'integer' },
			behind: { type: 'integer' },
			all: {
				type: 'array',
				items: { type: 'string' },
			},
		},
		required: ['current', 'upstream', 'ahead', 'behind', 'all'],
	},
	GitCommit: {
		type: 'object',
		properties: {
			hash: { type: 'string' },
			message: { type: 'string' },
			filesChanged: { type: 'integer' },
			insertions: { type: 'integer' },
			deletions: { type: 'integer' },
		},
		required: ['hash', 'message', 'filesChanged', 'insertions', 'deletions'],
	},
	Terminal: {
		type: 'object',
		properties: {
			id: { type: 'string' },
			pid: { type: 'integer' },
			command: { type: 'string' },
			args: {
				type: 'array',
				items: { type: 'string' },
			},
			cwd: { type: 'string' },
			purpose: { type: 'string' },
			createdBy: {
				type: 'string',
				enum: ['user', 'llm'],
			},
			title: { type: 'string' },
			status: {
				type: 'string',
				enum: ['running', 'exited'],
			},
			exitCode: { type: 'integer' },
			createdAt: { type: 'string', format: 'date-time' },
			uptime: { type: 'integer' },
		},
	},
} as const;
