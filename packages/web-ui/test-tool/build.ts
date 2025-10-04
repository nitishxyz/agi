#!/usr/bin/env bun
import { $ } from 'bun';

await $`bun build ./server.ts --compile --outfile ./dist/web-ui-server`;
console.log('✅ Built: ./dist/web-ui-server');
