export type AGIEventType =
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
	| 'error'
	| 'heartbeat';

export interface AGIEvent<T = unknown> {
	type: AGIEventType;
	sessionId: string;
	payload?: T;
}
