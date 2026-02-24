import type { Hono } from 'hono';
import {
	discoverSkills,
	loadSkill,
	loadSkillFile,
	discoverSkillFiles,
	findGitRoot,
	validateSkillName,
	parseSkillFile,
	logger,
} from '@ottocode/sdk';
import { serializeError } from '../runtime/errors/api-error.ts';

export function registerSkillsRoutes(app: Hono) {
	app.get('/v1/skills', async (c) => {
		try {
			const projectRoot = c.req.query('project') || process.cwd();
			const repoRoot = (await findGitRoot(projectRoot)) ?? projectRoot;
			const skills = await discoverSkills(projectRoot, repoRoot);
			return c.json({
				skills: skills.map((s) => ({
					name: s.name,
					description: s.description,
					scope: s.scope,
					path: s.path,
				})),
			});
		} catch (error) {
			logger.error('Failed to list skills', error);
			const errorResponse = serializeError(error);
			return c.json(errorResponse, (errorResponse.error.status || 500) as 500);
		}
	});

	app.get('/v1/skills/:name', async (c) => {
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
			return c.json(errorResponse, (errorResponse.error.status || 500) as 500);
		}
	});

	app.post('/v1/skills/validate', async (c) => {
		app.get('/v1/skills/:name/files', async (c) => {
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
		});

		app.get('/v1/skills/:name/files/*', async (c) => {
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
		});

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
	});

	app.get('/v1/skills/validate-name/:name', async (c) => {
		const name = c.req.param('name');
		return c.json({ valid: validateSkillName(name) });
	});
}
