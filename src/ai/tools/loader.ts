import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { finishTool } from '@/ai/tools/builtin/finish.ts';
import { buildFsTools } from '@/ai/tools/builtin/fs.ts';
import { buildGitTools } from '@/ai/tools/builtin/git.ts';
import { progressUpdateTool } from '@/ai/tools/builtin/progress.ts';
import { buildBashTool } from '@/ai/tools/builtin/bash.ts';
import { Glob } from 'bun';
import { dirname, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promises as fs } from 'node:fs';

export type DiscoveredTool = { name: string; tool: Tool };

type PluginParameter = {
	type: 'string' | 'number' | 'boolean';
	description?: string;
	default?: string | number | boolean;
	enum?: string[];
	optional?: boolean;
};

type PluginDescriptor = {
	name?: string;
	description?: string;
	parameters?: Record<string, PluginParameter>;
	execute?: PluginExecutor;
	run?: PluginExecutor;
	handler?: PluginExecutor;
	setup?: (context: PluginContext) => unknown | Promise<unknown>;
	onInit?: (context: PluginContext) => unknown | Promise<unknown>;
};

type PluginExecutor = (args: PluginExecuteArgs) => unknown | Promise<unknown>;

type PluginExecuteArgs = {
	input: Record<string, unknown>;
	project: string;
	projectRoot: string;
	directory: string;
	worktree: string;
	exec: ExecFn;
	run: ExecFn;
	$: TemplateExecFn;
	fs: FsHelpers;
	env: Record<string, string>;
	context: PluginContext;
};

type PluginContext = {
	project: string;
	projectRoot: string;
	directory: string;
	worktree: string;
	toolDir: string;
};

type ExecFn = (
	command: string,
	args?: string[] | ExecOptions,
	options?: ExecOptions,
) => Promise<ExecResult>;

type TemplateExecFn = (
	strings: TemplateStringsArray,
	...values: unknown[]
) => Promise<ExecResult>;

type ExecOptions = {
	cwd?: string;
	env?: Record<string, string>;
	allowNonZeroExit?: boolean;
};

type ExecResult = { exitCode: number; stdout: string; stderr: string };

type FsHelpers = {
	readFile: (path: string, encoding?: BufferEncoding) => Promise<string>;
	writeFile: (path: string, content: string) => Promise<void>;
	exists: (path: string) => Promise<boolean>;
};

const pluginPatterns = ['.agi/tools/*/tool.js', '.agi/tools/*/tool.mjs'];

export async function discoverProjectTools(
	projectRoot: string,
): Promise<DiscoveredTool[]> {
	const tools = new Map<string, Tool>();
	for (const { name, tool } of buildFsTools(projectRoot)) tools.set(name, tool);
	for (const { name, tool } of buildGitTools(projectRoot))
		tools.set(name, tool);
    // Built-ins
    tools.set('finish', finishTool);
    tools.set('progress_update', progressUpdateTool);
	const bash = buildBashTool(projectRoot);
	tools.set(bash.name, bash.tool);

	async function loadFromBase(base: string | null | undefined) {
		if (!base) return;
		for (const pattern of pluginPatterns) {
			const glob = new Glob(pattern, { dot: true });
			for await (const rel of glob.scan({ cwd: base, dot: true })) {
				const match = rel.match(/^\.agi\/tools\/([^/]+)\/tool\.(m?js)$/);
				if (!match) continue;
				const folder = match[1];
				const absPath = join(base, rel).replace(/\\/g, '/');
				try {
					const plugin = await loadPlugin(absPath, folder, projectRoot);
					if (plugin) tools.set(plugin.name, plugin.tool);
				} catch (err) {
					if (process.env.AGI_DEBUG_TOOLS === '1')
						console.error('Failed to load tool', absPath, err);
				}
			}
		}
	}

	const home = process.env.HOME || process.env.USERPROFILE || '';
	await loadFromBase(home || null);
	await loadFromBase(projectRoot);
	return Array.from(tools.entries()).map(([name, tool]) => ({ name, tool }));
}

async function loadPlugin(
	absPath: string,
	folder: string,
	projectRoot: string,
): Promise<DiscoveredTool | null> {
	const mod = await import(`${pathToFileURL(absPath).href}?t=${Date.now()}`);
	const candidate = resolveExport(mod);
	if (!candidate) throw new Error('No plugin export found');

	const context: PluginContext = {
		project: projectRoot,
		projectRoot,
		directory: projectRoot,
		worktree: projectRoot,
		toolDir: absPath.slice(0, absPath.lastIndexOf('/')),
	};

	let descriptor: PluginDescriptor | null | undefined;
	if (typeof candidate === 'function') descriptor = await candidate(context);
	else descriptor = candidate;
	if (!descriptor || typeof descriptor !== 'object')
		throw new Error('Plugin must return an object descriptor');

	if (typeof descriptor.setup === 'function') await descriptor.setup(context);
	if (typeof descriptor.onInit === 'function') await descriptor.onInit(context);

	const name = sanitizeName(descriptor.name ?? folder);
	const description = descriptor.description ?? `Custom tool ${name}`;
	const parameters = descriptor.parameters ?? {};
	const inputSchema = createInputSchema(parameters);
	const executor = resolveExecutor(descriptor);

	const helpersFactory = createHelpers(projectRoot, context.toolDir);

	const wrapped = tool({
		description,
		inputSchema,
		async execute(input) {
			const helpers = helpersFactory();
			const result = await executor({
				input: input as Record<string, unknown>,
				project: helpers.context.project,
				projectRoot: helpers.context.projectRoot,
				directory: helpers.context.directory,
				worktree: helpers.context.worktree,
				exec: helpers.exec,
				run: helpers.exec,
				$: helpers.templateExec,
				fs: helpers.fs,
				env: helpers.env,
				context: helpers.context,
			});
			return result ?? { ok: true };
		},
	});

	return { name, tool: wrapped };
}

function resolveExport(mod: Record<string, unknown>) {
	if (mod.default) return mod.default;
	if (mod.tool) return mod.tool;
	if (mod.plugin) return mod.plugin;
	if (mod.Tool) return mod.Tool;
	const values = Object.values(mod);
	return values.find(
		(value) => typeof value === 'function' || typeof value === 'object',
	);
}

function resolveExecutor(descriptor: PluginDescriptor): PluginExecutor {
	const fn = descriptor.execute ?? descriptor.run ?? descriptor.handler;
	if (typeof fn !== 'function')
		throw new Error('Plugin must provide an execute/run/handler function');
	return fn;
}

function sanitizeName(name: string) {
	const cleaned = name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
	return cleaned || 'tool';
}

function createInputSchema(parameters: Record<string, PluginParameter>) {
	const shape: Record<string, z.ZodTypeAny> = {};
	for (const [key, def] of Object.entries(parameters)) {
		let schema: z.ZodTypeAny;
		if (def.type === 'string') {
			const values = def.enum;
			schema = values?.length
				? z.enum(values as [string, ...string[]])
				: z.string();
		} else if (def.type === 'number') schema = z.number();
		else schema = z.boolean();
		if (def.description) schema = schema.describe(def.description);
		if (def.default !== undefined)
			schema = schema.default(def.default as never);
		else if (def.optional) schema = schema.optional();
		shape[key] = schema;
	}
	return Object.keys(shape).length ? z.object(shape).strict() : z.object({});
}

function createHelpers(projectRoot: string, toolDir: string) {
	return () => {
		const exec = createExec(projectRoot);
		const fsHelpers = createFsHelpers(projectRoot);
		const context: PluginContext = {
			project: projectRoot,
			projectRoot,
			directory: projectRoot,
			worktree: projectRoot,
			toolDir,
		};
		const env: Record<string, string> = {};
		for (const [key, value] of Object.entries(process.env))
			if (typeof value === 'string') env[key] = value;
		const templateExec: TemplateExecFn = (strings, ...values) => {
			const commandLine = strings.reduce((acc, part, index) => {
				const value = index < values.length ? String(values[index]) : '';
				return acc + part + value;
			}, '');
			const pieces = commandLine.trim().split(/\s+/).filter(Boolean);
			if (pieces.length === 0)
				throw new Error('Empty command passed to template executor');
			return exec(pieces[0], pieces.slice(1));
		};
		return {
			exec,
			fs: fsHelpers,
			env,
			templateExec,
			context,
		};
	};
}

function createExec(projectRoot: string): ExecFn {
	return async (
		command: string,
		argsOrOptions?: string[] | ExecOptions,
		maybeOptions?: ExecOptions,
	) => {
		let args: string[] = [];
		let options: ExecOptions = {};
		if (Array.isArray(argsOrOptions)) {
			args = argsOrOptions;
			options = maybeOptions ?? {};
		} else if (argsOrOptions) options = argsOrOptions;

		const cwd = options.cwd
			? resolveWithinProject(projectRoot, options.cwd)
			: projectRoot;
		const env: Record<string, string> = {};
		for (const [key, value] of Object.entries(process.env))
			if (typeof value === 'string') env[key] = value;
		if (options.env)
			for (const [key, value] of Object.entries(options.env)) env[key] = value;

		const proc = Bun.spawn([command, ...args], {
			cwd,
			env,
			stdout: 'pipe',
			stderr: 'pipe',
		});
		const exitCode = await proc.exited;
		const stdout = await new Response(proc.stdout).text();
		const stderr = await new Response(proc.stderr).text();
		if (exitCode !== 0 && !options.allowNonZeroExit) {
			const message = stderr.trim() || stdout.trim() || `${command} failed`;
			throw new Error(`${command} exited with code ${exitCode}: ${message}`);
		}
		return { exitCode, stdout, stderr };
	};
}

function createFsHelpers(projectRoot: string): FsHelpers {
	return {
		async readFile(path: string, encoding: BufferEncoding = 'utf-8') {
			const abs = resolveWithinProject(projectRoot, path);
			return fs.readFile(abs, { encoding });
		},
		async writeFile(path: string, content: string) {
			const abs = resolveWithinProject(projectRoot, path);
			await fs.mkdir(dirname(abs), { recursive: true });
			await fs.writeFile(abs, content, 'utf-8');
		},
		async exists(path: string) {
			const abs = resolveWithinProject(projectRoot, path);
			try {
				await fs.access(abs);
				return true;
			} catch {
				return false;
			}
		},
	};
}

function resolveWithinProject(projectRoot: string, target: string) {
	if (!target) return projectRoot;
	if (target.startsWith('~/')) {
		const home = process.env.HOME || process.env.USERPROFILE || '';
		return join(home, target.slice(2));
	}
	if (isAbsolute(target)) return target;
	return join(projectRoot, target);
}
