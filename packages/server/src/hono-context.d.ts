import type { EmbeddedAppConfig } from './index.ts';

declare module 'hono' {
	interface ContextVariableMap {
		embeddedConfig: EmbeddedAppConfig | undefined;
	}
}
