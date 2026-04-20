export type OttoEventType =
	| 'tool.approval.required'
	| 'tool.approval.updated'
	| 'tool.approval.resolved'
	| 'ottorouter.payment.required'
	| 'ottorouter.payment.signing'
	| 'ottorouter.payment.complete'
	| 'ottorouter.payment.error'
	| 'ottorouter.topup.required'
	| 'ottorouter.topup.method_selected'
	| 'ottorouter.topup.cancelled'
	| 'ottorouter.fiat.checkout_created'
	| 'ottorouter.balance.updated'
	| 'session.created'
	| 'session.deleted'
	| 'session.updated'
	| 'message.created'
	| 'message.updated'
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

export interface OttoEvent<T = unknown> {
	type: OttoEventType;
	sessionId: string;
	payload?: T;
}
