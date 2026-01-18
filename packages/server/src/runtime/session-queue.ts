import type { ProviderName } from './provider.ts';

export type RunOpts = {
	sessionId: string;
	assistantMessageId: string;
	agent: string;
	provider: ProviderName;
	model: string;
	projectRoot: string;
	oneShot?: boolean;
	userContext?: string;
	reasoning?: boolean;
	abortSignal?: AbortSignal;
	isCompactCommand?: boolean;
	compactionContext?: string;
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
 * Signals the abort controller for a session.
 * This will trigger the abortSignal in the streamText call.
 */
export function abortSession(sessionId: string) {
	const controller = sessionAbortControllers.get(sessionId);
	if (controller) {
		controller.abort();
		sessionAbortControllers.delete(sessionId);
	}
}

export function getRunnerState(sessionId: string): RunnerState | undefined {
	return runners.get(sessionId);
}

export function setRunning(sessionId: string, running: boolean) {
	const state = runners.get(sessionId);
	if (state) state.running = running;
}

export function dequeueJob(sessionId: string): RunOpts | undefined {
	const state = runners.get(sessionId);
	return state?.queue.shift();
}

export function cleanupSession(sessionId: string) {
	const state = runners.get(sessionId);
	if (state && state.queue.length === 0 && !state.running) {
		runners.delete(sessionId);
		// Clean up any lingering abort controller
		sessionAbortControllers.delete(sessionId);
	}
}
