import type { Hono } from 'hono';
import {
	resolveApproval,
	getPendingApproval,
	getPendingApprovalsForSession,
} from '../runtime/tools/approval.ts';
import { openApiRoute } from '../openapi/route.ts';

export function registerSessionApprovalRoute(app: Hono) {
	openApiRoute(
		app,
		{
			method: 'post',
			path: '/v1/sessions/{id}/approval',
			tags: ['sessions'],
			operationId: 'resolveApproval',
			summary: 'Approve or deny a tool execution',
			parameters: [
				{
					in: 'path',
					name: 'id',
					required: true,
					schema: {
						type: 'string',
					},
				},
			],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								callId: {
									type: 'string',
								},
								approved: {
									type: 'boolean',
								},
							},
							required: ['callId', 'approved'],
						},
					},
				},
			},
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									ok: {
										type: 'boolean',
									},
									callId: {
										type: 'string',
									},
									approved: {
										type: 'boolean',
									},
								},
								required: ['ok', 'callId', 'approved'],
							},
						},
					},
				},
				'400': {
					description: 'Bad Request',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									error: {
										type: 'string',
									},
								},
								required: ['error'],
							},
						},
					},
				},
				'403': {
					description: 'Bad Request',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									error: {
										type: 'string',
									},
								},
								required: ['error'],
							},
						},
					},
				},
				'404': {
					description: 'Bad Request',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									error: {
										type: 'string',
									},
								},
								required: ['error'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			const sessionId = c.req.param('id');
			const body = await c.req.json<{
				callId: string;
				approved: boolean;
			}>();

			if (!body.callId) {
				return c.json({ ok: false, error: 'callId is required' }, 400);
			}

			if (typeof body.approved !== 'boolean') {
				return c.json({ ok: false, error: 'approved must be a boolean' }, 400);
			}

			const pending = getPendingApproval(body.callId);
			if (!pending) {
				return c.json(
					{ ok: false, error: 'No pending approval found for this callId' },
					404,
				);
			}

			if (pending.sessionId !== sessionId) {
				return c.json(
					{ ok: false, error: 'Approval does not belong to this session' },
					403,
				);
			}

			const result = resolveApproval(body.callId, body.approved);

			if (!result.ok) {
				return c.json(result, 404);
			}

			return c.json({ ok: true, callId: body.callId, approved: body.approved });
		},
	);

	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/sessions/{id}/approval/pending',
			tags: ['sessions'],
			operationId: 'getPendingApprovals',
			summary: 'Get pending approvals for a session',
			parameters: [
				{
					in: 'path',
					name: 'id',
					required: true,
					schema: {
						type: 'string',
					},
				},
			],
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									ok: {
										type: 'boolean',
									},
									pending: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												callId: {
													type: 'string',
												},
												toolName: {
													type: 'string',
												},
												args: {
													type: 'object',
												},
												messageId: {
													type: 'string',
												},
												createdAt: {
													type: 'integer',
												},
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
		async (c) => {
			const sessionId = c.req.param('id');
			const pending = getPendingApprovalsForSession(sessionId);

			return c.json({
				ok: true,
				pending: pending.map((p) => ({
					callId: p.callId,
					toolName: p.toolName,
					args: p.args,
					messageId: p.messageId,
					createdAt: p.createdAt,
				})),
			});
		},
	);
}
