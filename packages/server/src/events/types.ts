export type OttoEventType =
	| 'tool.approval.required'
	| 'tool.approval.resolved'
	| 'setu.payment.required'
	| 'setu.payment.signing'
	| 'setu.payment.complete'
	| 'setu.payment.error'
	| 'setu.topup.required'
	| 'setu.topup.method_selected'
	| 'setu.topup.cancelled'
	| 'setu.fiat.checkout_created'
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

export interface OttoEvent<T = unknown> {
	type: OttoEventType;
	sessionId: string;
	payload?: T;
}
