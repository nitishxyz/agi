import type { Hono } from 'hono';
import { registerStatusRoute } from './status.ts';
import { registerBranchRoute } from './branch.ts';
import { registerDiffRoute } from './diff.ts';
import { registerStagingRoutes } from './staging.ts';
import { registerCommitRoutes } from './commit.ts';
import { registerPushRoute } from './push.ts';
import { registerPullRoute } from './pull.ts';
import { registerInitRoute } from './init.ts';

export type { GitFile } from './types.ts';

export function registerGitRoutes(app: Hono) {
	registerStatusRoute(app);
	registerBranchRoute(app);
	registerDiffRoute(app);
	registerStagingRoutes(app);
	registerCommitRoutes(app);
	registerPushRoute(app);
	registerPullRoute(app);
	registerInitRoute(app);
}
