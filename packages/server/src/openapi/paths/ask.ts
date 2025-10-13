import { errorResponse, projectQueryParam } from '../helpers';

export const askPaths = {
	'/v1/ask': {
		post: {
			tags: ['ask'],
			operationId: 'ask',
			summary: 'Send a prompt using the ask service',
			description:
				'Streamlined endpoint used by the CLI to send prompts and receive assistant responses. Creates sessions as needed and reuses the last session when requested.',
			parameters: [projectQueryParam()],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							required: ['prompt'],
							properties: {
								prompt: {
									type: 'string',
									description: 'User prompt to send to the assistant.',
								},
								agent: {
									type: 'string',
									description: 'Optional agent name to use for this request.',
								},
								provider: {
									$ref: '#/components/schemas/Provider',
									description:
										'Optional provider override. When omitted the agent and config defaults apply.',
								},
								model: {
									type: 'string',
									description:
										'Optional model override for the selected provider.',
								},
								sessionId: {
									type: 'string',
									description: 'Send the prompt to a specific session.',
								},
								last: {
									type: 'boolean',
									description:
										'If true, reuse the most recent session for the project.',
								},
								jsonMode: {
									type: 'boolean',
									description:
										'Request structured JSON output when supported by the agent.',
								},
							},
						},
					},
				},
			},
			responses: {
				202: {
					description: 'Accepted',
					content: {
						'application/json': {
							schema: { $ref: '#/components/schemas/AskResponse' },
						},
					},
				},
				400: errorResponse(),
			},
		},
	},
} as const;
