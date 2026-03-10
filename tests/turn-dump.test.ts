import { describe, expect, test } from 'bun:test';
import { TurnDumpCollector } from '../packages/server/src/runtime/debug/turn-dump.ts';

describe('turn dump collector', () => {
	test('keeps the final non-empty text snapshot', () => {
		const dump = new TurnDumpCollector({
			sessionId: 'session-1',
			messageId: 'message-1',
			provider: 'openai',
			model: 'gpt-5.4',
			agent: 'build',
		});

		dump.recordTextDelta(0, 'Hey');
		dump.recordTextDelta(0, 'Hey! What can I help you with?', { force: true });

		const snapshots = (
			dump as unknown as {
				data: {
					stream: {
						textDeltas: Array<{
							stepIndex: number;
							textSnapshot: string;
						}>;
					};
				};
			}
		).data.stream.textDeltas;

		expect(snapshots).toHaveLength(2);
		expect(snapshots[0]).toMatchObject({
			stepIndex: 0,
			textSnapshot: 'Hey',
		});
		expect(snapshots[1]).toMatchObject({
			stepIndex: 0,
			textSnapshot: 'Hey! What can I help you with?',
		});
	});

	test('skips forced empty snapshots after text has already been captured', () => {
		const dump = new TurnDumpCollector({
			sessionId: 'session-2',
			messageId: 'message-2',
			provider: 'openai',
			model: 'gpt-5.4',
			agent: 'build',
		});

		dump.recordTextDelta(0, 'Hey');
		dump.recordTextDelta(1, '', { force: true });

		const snapshots = (
			dump as unknown as {
				data: {
					stream: {
						textDeltas: Array<{
							stepIndex: number;
							textSnapshot: string;
						}>;
					};
				};
			}
		).data.stream.textDeltas;

		expect(snapshots).toHaveLength(1);
		expect(snapshots[0]).toMatchObject({
			stepIndex: 0,
			textSnapshot: 'Hey',
		});
	});
});
