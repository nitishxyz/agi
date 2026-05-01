import type { Hono } from 'hono';
import {
	discoverSkills,
	filterDiscoveredSkills,
	loadSkill,
	loadSkillFile,
	discoverSkillFiles,
	findGitRoot,
	validateSkillName,
	parseSkillFile,
	logger,
	loadConfig,
	writeSkillSettings,
} from '@ottocode/sdk';
import { serializeError } from '../runtime/errors/api-error.ts';
import { openApiRoute } from '../openapi/route.ts';

function dedupeSkillsByName<T extends { name: string }>(skills: T[]): T[] {
	const seen = new Set<string>();
	return skills.filter((skill) => {
		const key = skill.name.trim();
		if (!key || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function sortSkillsByName<T extends { name: string }>(skills: T[]): T[] {
	return [...skills].sort((a, b) => a.name.localeCompare(b.name));
}

function mapSkillsWithEnabled(
	discovered: Array<{
		name: string;
		description: string;
		scope: string;
		path: string;
	}>,
	cfg: Awaited<ReturnType<typeof loadConfig>>,
) {
	return discovered.map((skill) => ({
		name: skill.name,
		description: skill.description,
		scope: skill.scope,
		path: skill.path,
		enabled: cfg.skills?.items?.[skill.name]?.enabled !== false,
	}));
}

export function registerSkillsRoutes(app: Hono) {
	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/skills',
			tags: ['config'],
			operationId: 'listSkills',
			summary: 'List discovered skills',
			parameters: [
				{
					in: 'query',
					name: 'project',
					required: false,
					schema: {
						type: 'string',
					},
					description:
						'Project root override (defaults to current working directory).',
				},
			],
			responses: {
				'200': {
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
												name: {
													type: 'string',
												},
												description: {
													type: 'string',
												},
												scope: {
													type: 'string',
												},
												path: {
													type: 'string',
												},
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
				'500': {
					description: 'Bad Request',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									error: {
										type: 'string',
									},
								},
								required: ['error'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			try {
				const projectRoot = c.req.query('project') || process.cwd();
				const cfg = await loadConfig(projectRoot);
				const repoRoot = (await findGitRoot(projectRoot)) ?? projectRoot;
				const discovered = sortSkillsByName(
					await discoverSkills(projectRoot, repoRoot),
				);
				const filtered = filterDiscoveredSkills(discovered, cfg.skills);
				const unique = sortSkillsByName(dedupeSkillsByName(filtered));
				return c.json({
					skills: mapSkillsWithEnabled(unique, cfg),
				});
			} catch (error) {
				logger.error('Failed to list skills', error);
				const errorResponse = serializeError(error);
				return c.json(
					errorResponse,
					(errorResponse.error.status || 500) as 500,
				);
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/config/skills',
			tags: ['config'],
			operationId: 'getSkillsConfig',
			summary: 'Get skills enable/disable config and counts',
			parameters: [
				{
					in: 'query',
					name: 'project',
					required: false,
					schema: {
						type: 'string',
					},
					description:
						'Project root override (defaults to current working directory).',
				},
			],
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									enabled: {
										type: 'boolean',
									},
									totalCount: {
										type: 'number',
									},
									enabledCount: {
										type: 'number',
									},
									items: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												name: {
													type: 'string',
												},
												description: {
													type: 'string',
												},
												scope: {
													type: 'string',
												},
												path: {
													type: 'string',
												},
												enabled: {
													type: 'boolean',
												},
											},
											required: [
												'name',
												'description',
												'scope',
												'path',
												'enabled',
											],
										},
									},
								},
								required: ['enabled', 'totalCount', 'enabledCount', 'items'],
							},
						},
					},
				},
				'500': {
					description: 'Bad Request',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									error: {
										type: 'string',
									},
								},
								required: ['error'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			try {
				const projectRoot = c.req.query('project') || process.cwd();
				const cfg = await loadConfig(projectRoot);
				const repoRoot = (await findGitRoot(projectRoot)) ?? projectRoot;
				const discovered = sortSkillsByName(
					dedupeSkillsByName(await discoverSkills(projectRoot, repoRoot)),
				);
				const filtered = sortSkillsByName(
					filterDiscoveredSkills(discovered, cfg.skills),
				);
				return c.json({
					enabled: cfg.skills?.enabled !== false,
					totalCount: discovered.length,
					enabledCount: filtered.length,
					items: mapSkillsWithEnabled(discovered, cfg),
				});
			} catch (error) {
				logger.error('Failed to get skills config', error);
				const errorResponse = serializeError(error);
				return c.json(
					errorResponse,
					(errorResponse.error.status || 500) as 500,
				);
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'put',
			path: '/v1/config/skills',
			tags: ['config'],
			operationId: 'updateSkillsConfig',
			summary: 'Update skills enable/disable config',
			parameters: [
				{
					in: 'query',
					name: 'project',
					required: false,
					schema: {
						type: 'string',
					},
					description:
						'Project root override (defaults to current working directory).',
				},
			],
			requestBody: {
				required: true,
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								enabled: {
									type: 'boolean',
								},
								items: {
									type: 'object',
									additionalProperties: {
										type: 'object',
										properties: {
											enabled: {
												type: 'boolean',
											},
										},
									},
								},
							},
						},
					},
				},
			},
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									success: {
										type: 'boolean',
									},
									enabled: {
										type: 'boolean',
									},
									totalCount: {
										type: 'number',
									},
									enabledCount: {
										type: 'number',
									},
									items: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												name: {
													type: 'string',
												},
												description: {
													type: 'string',
												},
												scope: {
													type: 'string',
												},
												path: {
													type: 'string',
												},
												enabled: {
													type: 'boolean',
												},
											},
											required: [
												'name',
												'description',
												'scope',
												'path',
												'enabled',
											],
										},
									},
								},
								required: [
									'success',
									'enabled',
									'totalCount',
									'enabledCount',
									'items',
								],
							},
						},
					},
				},
				'500': {
					description: 'Bad Request',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									error: {
										type: 'string',
									},
								},
								required: ['error'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			try {
				const projectRoot = c.req.query('project') || process.cwd();
				const body = await c.req.json<{
					enabled?: boolean;
					items?: Record<string, { enabled?: boolean }>;
				}>();
				await writeSkillSettings(
					'global',
					{
						...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
						...(body.items ? { items: body.items } : {}),
					},
					projectRoot,
				);
				const cfg = await loadConfig(projectRoot);
				const repoRoot = (await findGitRoot(projectRoot)) ?? projectRoot;
				const discovered = sortSkillsByName(
					dedupeSkillsByName(await discoverSkills(projectRoot, repoRoot)),
				);
				const filtered = sortSkillsByName(
					filterDiscoveredSkills(discovered, cfg.skills),
				);
				return c.json({
					success: true,
					enabled: cfg.skills?.enabled !== false,
					totalCount: discovered.length,
					enabledCount: filtered.length,
					items: mapSkillsWithEnabled(discovered, cfg),
				});
			} catch (error) {
				logger.error('Failed to update skills config', error);
				const errorResponse = serializeError(error);
				return c.json(
					errorResponse,
					(errorResponse.error.status || 500) as 500,
				);
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/skills/{name}',
			tags: ['config'],
			operationId: 'getSkill',
			summary: 'Get a skill by name',
			parameters: [
				{
					in: 'path',
					name: 'name',
					required: true,
					schema: {
						type: 'string',
					},
				},
				{
					in: 'query',
					name: 'project',
					required: false,
					schema: {
						type: 'string',
					},
					description:
						'Project root override (defaults to current working directory).',
				},
			],
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									name: {
										type: 'string',
									},
									description: {
										type: 'string',
									},
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
										items: {
											type: 'string',
										},
										nullable: true,
									},
									path: {
										type: 'string',
									},
									scope: {
										type: 'string',
									},
									content: {
										type: 'string',
									},
								},
								required: ['name', 'description', 'path', 'scope', 'content'],
							},
						},
					},
				},
				'404': {
					description: 'Bad Request',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									error: {
										type: 'string',
									},
								},
								required: ['error'],
							},
						},
					},
				},
				'500': {
					description: 'Bad Request',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									error: {
										type: 'string',
									},
								},
								required: ['error'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			try {
				const name = c.req.param('name');
				const projectRoot = c.req.query('project') || process.cwd();
				const repoRoot = (await findGitRoot(projectRoot)) ?? projectRoot;
				await discoverSkills(projectRoot, repoRoot);

				const skill = await loadSkill(name);
				if (!skill) {
					return c.json({ error: `Skill '${name}' not found` }, 404);
				}

				return c.json({
					name: skill.metadata.name,
					description: skill.metadata.description,
					license: skill.metadata.license ?? null,
					compatibility: skill.metadata.compatibility ?? null,
					metadata: skill.metadata.metadata ?? null,
					allowedTools: skill.metadata.allowedTools ?? null,
					path: skill.path,
					scope: skill.scope,
					content: skill.content,
				});
			} catch (error) {
				logger.error('Failed to load skill', error);
				const errorResponse = serializeError(error);
				return c.json(
					errorResponse,
					(errorResponse.error.status || 500) as 500,
				);
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/skills/{name}/files',
			tags: ['config'],
			operationId: 'listSkillFiles',
			summary: 'List files in a skill directory',
			parameters: [
				{
					in: 'path',
					name: 'name',
					required: true,
					schema: {
						type: 'string',
					},
				},
				{
					in: 'query',
					name: 'project',
					required: false,
					schema: {
						type: 'string',
					},
					description:
						'Project root override (defaults to current working directory).',
				},
			],
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									files: {
										type: 'array',
										items: {
											type: 'object',
											properties: {
												relativePath: {
													type: 'string',
												},
												size: {
													type: 'number',
												},
											},
											required: ['relativePath', 'size'],
										},
									},
								},
								required: ['files'],
							},
						},
					},
				},
				'500': {
					description: 'Bad Request',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									error: {
										type: 'string',
									},
								},
								required: ['error'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			try {
				const name = c.req.param('name');
				const projectRoot = c.req.query('project') || process.cwd();
				const repoRoot = (await findGitRoot(projectRoot)) ?? projectRoot;
				await discoverSkills(projectRoot, repoRoot);

				const files = await discoverSkillFiles(name);
				return c.json({ files });
			} catch (error) {
				logger.error('Failed to list skill files', error);
				const errorResponse = serializeError(error);
				return c.json(
					errorResponse,
					(errorResponse.error.status || 500) as 500,
				);
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/skills/{name}/files/{filePath}',
			tags: ['config'],
			operationId: 'getSkillFile',
			summary: 'Read a specific file from a skill directory',
			parameters: [
				{
					in: 'path',
					name: 'name',
					required: true,
					schema: {
						type: 'string',
					},
				},
				{
					in: 'path',
					name: 'filePath',
					required: true,
					schema: {
						type: 'string',
					},
				},
				{
					in: 'query',
					name: 'project',
					required: false,
					schema: {
						type: 'string',
					},
					description:
						'Project root override (defaults to current working directory).',
				},
			],
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									content: {
										type: 'string',
									},
									path: {
										type: 'string',
									},
								},
								required: ['content', 'path'],
							},
						},
					},
				},
				'404': {
					description: 'Bad Request',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									error: {
										type: 'string',
									},
								},
								required: ['error'],
							},
						},
					},
				},
				'500': {
					description: 'Bad Request',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									error: {
										type: 'string',
									},
								},
								required: ['error'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			try {
				const name = c.req.param('name');
				const filePath = c.req.path.replace(`/v1/skills/${name}/files/`, '');
				const projectRoot = c.req.query('project') || process.cwd();
				const repoRoot = (await findGitRoot(projectRoot)) ?? projectRoot;
				await discoverSkills(projectRoot, repoRoot);

				const result = await loadSkillFile(name, filePath);
				if (!result) {
					return c.json(
						{ error: `File '${filePath}' not found in skill '${name}'` },
						404,
					);
				}
				return c.json({ content: result.content, path: result.resolvedPath });
			} catch (error) {
				logger.error('Failed to load skill file', error);
				const errorResponse = serializeError(error);
				return c.json(
					errorResponse,
					(errorResponse.error.status || 500) as 500,
				);
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'post',
			path: '/v1/skills/validate',
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
								content: {
									type: 'string',
								},
								path: {
									type: 'string',
								},
							},
							required: ['content'],
						},
					},
				},
			},
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									valid: {
										type: 'boolean',
									},
									name: {
										type: 'string',
									},
									description: {
										type: 'string',
									},
									license: {
										type: 'string',
										nullable: true,
									},
									error: {
										type: 'string',
									},
								},
								required: ['valid'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			try {
				const body = await c.req.json<{ content: string; path?: string }>();
				if (!body.content) {
					return c.json({ error: 'content is required' }, 400);
				}

				const skillPath = body.path ?? 'SKILL.md';
				const skill = parseSkillFile(body.content, skillPath, 'cwd');
				return c.json({
					valid: true,
					name: skill.metadata.name,
					description: skill.metadata.description,
					license: skill.metadata.license ?? null,
				});
			} catch (error) {
				return c.json({
					valid: false,
					error: (error as Error).message,
				});
			}
		},
	);

	openApiRoute(
		app,
		{
			method: 'get',
			path: '/v1/skills/validate-name/{name}',
			tags: ['config'],
			operationId: 'validateSkillName',
			summary: 'Check if a skill name is valid',
			parameters: [
				{
					in: 'path',
					name: 'name',
					required: true,
					schema: {
						type: 'string',
					},
				},
			],
			responses: {
				'200': {
					description: 'OK',
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: {
									valid: {
										type: 'boolean',
									},
								},
								required: ['valid'],
							},
						},
					},
				},
			},
		},
		async (c) => {
			const name = c.req.param('name');
			return c.json({ valid: validateSkillName(name) });
		},
	);
}
