export function projectQueryParam() {
	return {
		in: 'query',
		name: 'project',
		required: false,
		schema: { type: 'string' },
		description:
			'Project root override (defaults to current working directory).',
	} as const;
}

export function sessionIdParam() {
	return {
		in: 'path',
		name: 'id',
		required: true,
		schema: { type: 'string' },
	} as const;
}

export function withoutParam() {
	return {
		in: 'query',
		name: 'without',
		required: false,
		schema: { type: 'string', enum: ['parts'] },
		description:
			'Exclude parts from the response. By default, parts are included.',
	} as const;
}

export function errorResponse() {
	return {
		description: 'Bad Request',
		content: {
			'application/json': {
				schema: {
					type: 'object',
					properties: { error: { type: 'string' } },
					required: ['error'],
				},
			},
		},
	} as const;
}

export function gitErrorResponse() {
	return {
		description: 'Error',
		content: {
			'application/json': {
				schema: {
					type: 'object',
					properties: {
						status: { type: 'string', enum: ['error'] },
						error: { type: 'string' },
						code: { type: 'string' },
					},
					required: ['status', 'error'],
				},
			},
		},
	} as const;
}
