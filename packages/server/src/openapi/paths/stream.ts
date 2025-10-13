import { projectQueryParam, sessionIdParam } from '../helpers';

export const streamPaths = {
	'/v1/sessions/{id}/stream': {
		get: {
			tags: ['stream'],
			operationId: 'subscribeSessionStream',
			summary: 'Subscribe to session event stream (SSE)',
			parameters: [projectQueryParam(), sessionIdParam()],
			responses: {
				200: {
					description: 'text/event-stream',
					content: {
						'text/event-stream': {
							schema: {
								type: 'string',
								description:
									'SSE event stream. Events include session.created, message.created, message.part.delta, tool.call, tool.delta, tool.result, message.completed, error.',
							},
						},
					},
				},
			},
		},
	},
} as const;
