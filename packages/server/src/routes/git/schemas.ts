import { z } from 'zod/v3';

export const gitStatusSchema = z.object({
	project: z.string().optional(),
});

export const gitDiffSchema = z.object({
	project: z.string().optional(),
	file: z.string(),
	staged: z
		.string()
		.optional()
		.transform((val) => val === 'true'),
});

export const gitStageSchema = z.object({
	project: z.string().optional(),
	files: z.array(z.string()),
});

export const gitUnstageSchema = z.object({
	project: z.string().optional(),
	files: z.array(z.string()),
});

export const gitRestoreSchema = z.object({
	project: z.string().optional(),
	files: z.array(z.string()),
});

export const gitDeleteSchema = z.object({
	project: z.string().optional(),
	files: z.array(z.string()),
});

export const gitCommitSchema = z.object({
	project: z.string().optional(),
	message: z.string().min(1),
});

export const gitGenerateCommitMessageSchema = z.object({
	project: z.string().optional(),
	sessionId: z.string().optional(),
});

export const gitPushSchema = z.object({
	project: z.string().optional(),
});
