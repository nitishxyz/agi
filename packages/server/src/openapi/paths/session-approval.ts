import { errorResponse } from '../helpers';

const sessionIdParam = {
	in: 'path',
	name: 'id',
	required: true,
	schema: { type: 'string' },
} as const;

export const sessionApprovalPaths = {
	'/v1/sessions/{id}/approval': {
		post: {
			tags: ['sessions'],
			operationId: 'resolveApproval',
			summary: 'Approve or deny a tool execution',
			parameters: [sessionIdParam],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								callId: { type: 'string' },
								approved: { type: 'boolean' },
							},
							required: ['callId', 'approved'],
						},
					},
				},
			},
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									ok: { type: 'boolean' },
									callId: { type: 'string' },
									approved: { type: 'boolean' },
								},
								required: ['ok', 'callId', 'approved'],
							},
						},
					},
				},
				400: errorResponse(),
				403: errorResponse(),
				404: errorResponse(),
			},
		},
	},
	'/v1/sessions/{id}/approval/pending': {
		get: {
			tags: ['sessions'],
			operationId: 'getPendingApprovals',
			summary: 'Get pending approvals for a session',
			parameters: [sessionIdParam],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									ok: { type: 'boolean' },
									pending: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												callId: { type: 'string' },
												toolName: { type: 'string' },
												args: { type: 'object' },
												messageId: { type: 'string' },
												createdAt: { type: 'integer' },
											},
											required: ['callId', 'toolName', 'createdAt'],
										},
									},
								},
								required: ['ok', 'pending'],
							},
						},
					},
				},
			},
		},
	},
} as const;
