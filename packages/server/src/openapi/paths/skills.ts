import { errorResponse, projectQueryParam } from '../helpers';

export const skillsPaths = {
	'/v1/skills': {
		get: {
			tags: ['config'],
			operationId: 'listSkills',
			summary: 'List discovered skills',
			parameters: [projectQueryParam()],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									skills: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												name: { type: 'string' },
												description: { type: 'string' },
												scope: { type: 'string' },
												path: { type: 'string' },
											},
											required: ['name', 'description', 'scope', 'path'],
										},
									},
								},
								required: ['skills'],
							},
						},
					},
				},
				500: errorResponse(),
			},
		},
	},
	'/v1/skills/{name}': {
		get: {
			tags: ['config'],
			operationId: 'getSkill',
			summary: 'Get a skill by name',
			parameters: [
				{
					in: 'path',
					name: 'name',
					required: true,
					schema: { type: 'string' },
				},
				projectQueryParam(),
			],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									name: { type: 'string' },
									description: { type: 'string' },
									license: {
										type: 'string',
										nullable: true,
									},
									compatibility: {
										type: 'string',
										nullable: true,
									},
									metadata: {
										type: 'object',
										nullable: true,
									},
									allowedTools: {
										type: 'array',
										items: { type: 'string' },
										nullable: true,
									},
									path: { type: 'string' },
									scope: { type: 'string' },
									content: { type: 'string' },
								},
								required: ['name', 'description', 'path', 'scope', 'content'],
							},
						},
					},
				},
				404: errorResponse(),
				500: errorResponse(),
			},
		},
	},
	'/v1/skills/validate': {
		post: {
			tags: ['config'],
			operationId: 'validateSkill',
			summary: 'Validate a SKILL.md content',
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								content: { type: 'string' },
								path: { type: 'string' },
							},
							required: ['content'],
						},
					},
				},
			},
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									valid: { type: 'boolean' },
									name: { type: 'string' },
									description: { type: 'string' },
									license: {
										type: 'string',
										nullable: true,
									},
									error: { type: 'string' },
								},
								required: ['valid'],
							},
						},
					},
				},
			},
		},
	},
	'/v1/skills/validate-name/{name}': {
		get: {
			tags: ['config'],
			operationId: 'validateSkillName',
			summary: 'Check if a skill name is valid',
			parameters: [
				{
					in: 'path',
					name: 'name',
					required: true,
					schema: { type: 'string' },
				},
			],
			responses: {
				200: {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									valid: { type: 'boolean' },
								},
								required: ['valid'],
							},
						},
					},
				},
			},
		},
	},
} as const;
