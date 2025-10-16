export const terminalsPath = {
	'/v1/terminals': {
		get: {
			operationId: 'getTerminals',
			summary: 'List all terminals',
			description: 'Get a list of all active terminal sessions',
			responses: {
				'200': {
					description: 'List of terminals',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									terminals: {
										type: 'array',
										items: {
											$ref: '#/components/schemas/Terminal',
										},
									},
									count: {
										type: 'integer',
									},
								},
							},
						},
					},
				},
			},
		},
		post: {
			operationId: 'postTerminals',
			summary: 'Create a new terminal',
			description: 'Spawn a new terminal process',
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							required: ['command', 'purpose'],
							properties: {
								command: {
									type: 'string',
									description: 'Command to execute',
								},
								args: {
									type: 'array',
									items: { type: 'string' },
									description: 'Command arguments',
								},
								purpose: {
									type: 'string',
									description: 'Description of terminal purpose',
								},
								cwd: {
									type: 'string',
									description: 'Working directory',
								},
								title: {
									type: 'string',
									description: 'Terminal title',
								},
							},
						},
					},
				},
			},
			responses: {
				'200': {
					description: 'Terminal created',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									terminalId: { type: 'string' },
									pid: { type: 'integer' },
									purpose: { type: 'string' },
									command: { type: 'string' },
								},
							},
						},
					},
				},
			},
		},
	},
	'/v1/terminals/{id}': {
		get: {
			operationId: 'getTerminalsById',
			summary: 'Get terminal details',
			description: 'Get information about a specific terminal',
			parameters: [
				{
					name: 'id',
					in: 'path',
					required: true,
					schema: { type: 'string' },
				},
			],
			responses: {
				'200': {
					description: 'Terminal details',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									terminal: {
										$ref: '#/components/schemas/Terminal',
									},
								},
							},
						},
					},
				},
				'404': {
					description: 'Terminal not found',
				},
			},
		},
		delete: {
			operationId: 'deleteTerminalsById',
			summary: 'Kill terminal',
			description: 'Terminate a running terminal process',
			parameters: [
				{
					name: 'id',
					in: 'path',
					required: true,
					schema: { type: 'string' },
				},
			],
			responses: {
				'200': {
					description: 'Terminal killed',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									success: { type: 'boolean' },
								},
							},
						},
					},
				},
			},
		},
	},
	'/v1/terminals/{id}/output': {
		get: {
			operationId: 'getTerminalsByIdOutput',
			summary: 'Stream terminal output',
			description: 'Get real-time terminal output via SSE',
			parameters: [
				{
					name: 'id',
					in: 'path',
					required: true,
					schema: { type: 'string' },
				},
			],
			responses: {
				'200': {
					description: 'SSE stream of terminal output',
					content: {
						'text/event-stream': {
							schema: {
								type: 'string',
							},
						},
					},
				},
			},
		},
	},
	'/v1/terminals/{id}/input': {
		post: {
			operationId: 'postTerminalsByIdInput',
			summary: 'Send input to terminal',
			description: 'Write data to terminal stdin',
			parameters: [
				{
					name: 'id',
					in: 'path',
					required: true,
					schema: { type: 'string' },
				},
			],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							required: ['input'],
							properties: {
								input: {
									type: 'string',
									description: 'Input to send to terminal',
								},
							},
						},
					},
				},
			},
			responses: {
				'200': {
					description: 'Input sent',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									success: { type: 'boolean' },
								},
							},
						},
					},
				},
			},
		},
	},
};
