import { describe, expect, test } from 'bun:test';
import {
	requiresApproval,
	skipsGuardApproval,
} from '../packages/server/src/runtime/tools/approval.ts';

describe('tool approval modes', () => {
	test('yolo does not add baseline tool approvals', () => {
		expect(requiresApproval('shell', 'yolo')).toBe(false);
		expect(requiresApproval('write', 'yolo')).toBe(false);
		expect(requiresApproval('git_push', 'yolo')).toBe(false);
	});

	test('dangerous mode still requires approval for dangerous tools', () => {
		expect(requiresApproval('shell', 'dangerous')).toBe(true);
		expect(requiresApproval('bash', 'dangerous')).toBe(true);
		expect(requiresApproval('write', 'dangerous')).toBe(true);
		expect(requiresApproval('read', 'dangerous')).toBe(false);
	});

	test('yolo skips guard-driven approvals only', () => {
		expect(skipsGuardApproval('yolo')).toBe(true);
		expect(skipsGuardApproval('auto')).toBe(false);
		expect(skipsGuardApproval('dangerous')).toBe(false);
		expect(skipsGuardApproval('all')).toBe(false);
		expect(skipsGuardApproval(undefined)).toBe(false);
	});
});
