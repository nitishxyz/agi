import type { Hono } from 'hono';
import {
	resolveApproval,
	getPendingApprovalsForSession,
} from '../runtime/tools/approval.ts';

export function registerSessionApprovalRoute(app: Hono) {
	app.post('/v1/sessions/:id/approval', async (c) => {
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

		console.log('[approval-route] Received approval request', {
			sessionId,
			callId: body.callId,
			approved: body.approved,
		});

		const result = resolveApproval(body.callId, body.approved);

		if (!result.ok) {
			return c.json(result, 404);
		}

		return c.json({ ok: true, callId: body.callId, approved: body.approved });
	});

	app.get('/v1/sessions/:id/approval/pending', async (c) => {
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
	});
}
