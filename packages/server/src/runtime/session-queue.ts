import type { ProviderName } from './provider.ts';

export type RunOpts = {
	sessionId: string;
	assistantMessageId: string;
	assistantPartId: string;
	agent: string;
	provider: ProviderName;
	model: string;
	projectRoot: string;
	oneShot?: boolean;
	abortSignal?: AbortSignal;
};

type RunnerState = { queue: RunOpts[]; running: boolean };

// Global state for session queues
const runners = new Map<string, RunnerState>();

// Track active abort controllers per session
const sessionAbortControllers = new Map<string, AbortController>();

/**
 * Enqueues an assistant run for a given session.
 * Creates an abort controller for the session if one doesn't exist.
 */
export function enqueueAssistantRun(
	opts: Omit<RunOpts, 'abortSignal'>,
	processQueueFn: (sessionId: string) => Promise<void>,
) {
	// Create abort controller for this session
	const abortController = new AbortController();
	sessionAbortControllers.set(opts.sessionId, abortController);

	const state = runners.get(opts.sessionId) ?? { queue: [], running: false };
	state.queue.push({ ...opts, abortSignal: abortController.signal });
	runners.set(opts.sessionId, state);
	if (!state.running) void processQueueFn(opts.sessionId);
}

/**
 * Aborts all pending operations for a given session.
 */
export function abortSession(sessionId: string) {
	const controller = sessionAbortControllers.get(sessionId);
	if (controller) {
		controller.abort();
		sessionAbortControllers.delete(sessionId);
	}
}

/**
 * Gets the current state of a session's queue.
 */
export function getRunnerState(sessionId: string): RunnerState | undefined {
	return runners.get(sessionId);
}

/**
 * Marks a session queue as running.
 */
export function setRunning(sessionId: string, running: boolean) {
	const state = runners.get(sessionId);
	if (state) {
		state.running = running;
	}
}

/**
 * Dequeues the next job from a session's queue.
 */
export function dequeueJob(sessionId: string): RunOpts | undefined {
	const state = runners.get(sessionId);
	return state?.queue.shift();
}

/**
 * Cleanup abort controller for a session (called when queue is done).
 */
export function cleanupSession(sessionId: string) {
	sessionAbortControllers.delete(sessionId);
}
