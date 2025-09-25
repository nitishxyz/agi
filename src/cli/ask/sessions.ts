import type { ProviderId } from '@/auth/index.ts';
import { catalog } from '@/providers/catalog.ts';
import type { AskOptions, SessionMeta } from './types.ts';
import { httpJson } from './http.ts';

export type SessionHeader = {
	agent?: string;
	provider?: string;
	model?: string;
	sessionId?: string;
};

export type SessionResolution = {
	sessionId: string;
	header: SessionHeader;
	provider: ProviderId;
	model: string;
	message?: { kind: 'created' | 'last'; sessionId: string };
};

export async function resolveSession(args: {
	baseUrl: string;
	projectRoot: string;
	opts: AskOptions;
	defaultAgent: string;
	providerOverride?: ProviderId;
	modelOverride?: string;
	chosenProvider: ProviderId;
	chosenModel: string;
	jsonMode: boolean;
}): Promise<SessionResolution> {
	const {
		baseUrl,
		projectRoot,
		opts,
		providerOverride,
		modelOverride,
		chosenProvider,
		chosenModel,
		jsonMode,
	} = args;

	let provider = chosenProvider;
	let model = chosenModel;
	let header: SessionHeader = {};
	let sessionId: string;
	let message: SessionResolution['message'];

	if (opts.sessionId) {
		sessionId = String(opts.sessionId);
		try {
			const sessions = await httpJson<SessionMeta[]>(
				'GET',
				`${baseUrl}/v1/sessions?project=${encodeURIComponent(projectRoot)}`,
			);
			const found = sessions.find((s) => String(s.id) === String(sessionId));
			if (found)
				header = {
					agent: found.agent,
					provider: found.provider,
					model: found.model,
					sessionId,
				};
		} catch {}
	} else if (opts.last) {
		const sessions = await httpJson<SessionMeta[]>(
			'GET',
			`${baseUrl}/v1/sessions?project=${encodeURIComponent(projectRoot)}`,
		);
		if (!sessions.length) {
			const created = await httpJson<SessionMeta>(
				'POST',
				`${baseUrl}/v1/sessions?project=${encodeURIComponent(projectRoot)}`,
				{
					title: null,
					agent: opts.agent ?? args.defaultAgent,
					provider: providerOverride,
					model: modelOverride,
				},
			);
			sessionId = String(created.id);
			provider = (created.provider ?? provider) as ProviderId;
			model = created.model ?? model;
			header = {
				agent: created.agent ?? opts.agent ?? args.defaultAgent,
				provider: created.provider ?? provider,
				model: created.model ?? model,
				sessionId,
			};
			if (!jsonMode)
				message = { kind: 'created', sessionId };
		} else {
			sessionId = String(sessions[0].id);
			header = {
				agent: sessions[0].agent,
				provider: sessions[0].provider,
				model: sessions[0].model,
				sessionId,
			};
			if (header.provider)
				provider = header.provider as ProviderId;
			if (header.model) model = header.model;
			if (!jsonMode)
				message = { kind: 'last', sessionId };
		}
	} else {
		const created = await httpJson<SessionMeta>(
			'POST',
			`${baseUrl}/v1/sessions?project=${encodeURIComponent(projectRoot)}`,
			{
				title: null,
				agent: opts.agent ?? args.defaultAgent,
				provider: providerOverride,
				model:
					modelOverride ??
					(opts.provider
						? catalogFirstModel(opts.provider)
						: undefined),
			},
		);
		sessionId = String(created.id);
		provider = (created.provider ?? provider) as ProviderId;
		model = created.model ?? model;
		header = {
			agent: created.agent ?? opts.agent ?? args.defaultAgent,
			provider: created.provider ?? provider,
			model: created.model ?? model,
			sessionId,
		};
		if (!jsonMode)
			message = { kind: 'created', sessionId };
	}

	return {
		sessionId,
		header,
		provider,
		model,
		message,
	};
}

function catalogFirstModel(provider: ProviderId | undefined) {
	if (!provider) return undefined;
	const entry = catalog[provider];
	return entry?.models?.[0]?.id;
}
