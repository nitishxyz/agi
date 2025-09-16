export type AGIEventType =
	| 'session.created'
	| 'message.created'
	| 'message.part.delta'
	| 'message.completed'
	| 'tool.call'
	| 'tool.delta'
	| 'tool.result'
	| 'error'
	| 'heartbeat';

export interface AGIEvent<T = unknown> {
	type: AGIEventType;
	sessionId: string;
	payload?: T;
}
