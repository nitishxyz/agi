export type AGIEventType =
	| 'tool.approval.required'
	| 'tool.approval.resolved'
	| 'setu.payment.required'
	| 'setu.payment.signing'
	| 'setu.payment.complete'
	| 'setu.payment.error'
	| 'session.created'
	| 'session.updated'
	| 'message.created'
	| 'message.part.delta'
	| 'reasoning.delta'
	| 'message.completed'
	| 'tool.call'
	| 'tool.delta'
	| 'tool.result'
	| 'plan.updated'
	| 'finish-step'
	| 'usage'
	| 'queue.updated'
	| 'error'
	| 'heartbeat';

export interface AGIEvent<T = unknown> {
	type: AGIEventType;
	sessionId: string;
	payload?: T;
}
