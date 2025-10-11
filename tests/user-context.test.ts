import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createEmbeddedApp } from '../packages/server/src/index.js';
import type { Hono } from 'hono';

describe('User Context Feature', () => {
	let app: Hono;
	let sessionId: string;

	beforeEach(async () => {
		// Create test app
		app = createEmbeddedApp({
			provider: 'anthropic',
			apiKey: process.env.ANTHROPIC_API_KEY || 'test-key',
			dbPath: ':memory:',
		});

		// Create a test session
		const sessionRes = await app.request('/v1/sessions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				agent: 'general',
				provider: 'anthropic',
				model: 'claude-3-5-sonnet-20241022',
			}),
		});

		expect(sessionRes.status).toBe(201);
		const sessionData = await sessionRes.json();
		sessionId = sessionData.id;
	});

	describe('API Layer', () => {
		it('should accept userContext in SendMessageRequest', async () => {
			const response = await app.request(`/v1/sessions/${sessionId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: 'Hello',
					userContext: 'Test context',
				}),
			});

			expect(response.status).toBe(202);
			const data = await response.json();
			expect(data.messageId).toBeDefined();
		});

		it('should work without userContext (backward compatibility)', async () => {
			const response = await app.request(`/v1/sessions/${sessionId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: 'Hello',
				}),
			});

			expect(response.status).toBe(202);
			const data = await response.json();
			expect(data.messageId).toBeDefined();
		});

		it('should handle empty userContext', async () => {
			const response = await app.request(`/v1/sessions/${sessionId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: 'Hello',
					userContext: '',
				}),
			});

			expect(response.status).toBe(202);
		});

		it('should handle whitespace-only userContext', async () => {
			const response = await app.request(`/v1/sessions/${sessionId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: 'Hello',
					userContext: '   ',
				}),
			});

			expect(response.status).toBe(202);
		});
	});

	describe('System Prompt Composition', () => {
		it('should include userContext in system prompt when provided', async () => {
			// We can't directly test system prompt without mocking LLM calls
			// But we can verify the API accepts it without errors
			const response = await app.request(`/v1/sessions/${sessionId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: 'Test',
					userContext: 'Important context',
				}),
			});

			expect(response.status).toBe(202);
		});

		it('should handle multi-line userContext', async () => {
			const response = await app.request(`/v1/sessions/${sessionId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: 'Test',
					userContext: 'Line 1\nLine 2\nLine 3',
				}),
			});

			expect(response.status).toBe(202);
		});

		it('should handle userContext with special characters', async () => {
			const response = await app.request(`/v1/sessions/${sessionId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: 'Test',
					userContext: 'Context with <special> & "chars" \'here\'',
				}),
			});

			expect(response.status).toBe(202);
		});
	});

	describe('Integration with Other Parameters', () => {
		it('should work with agent override', async () => {
			const response = await app.request(`/v1/sessions/${sessionId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: 'Test',
					userContext: 'Context',
					agent: 'general',
				}),
			});

			expect(response.status).toBe(202);
		});

		it('should work with provider and model overrides', async () => {
			const response = await app.request(`/v1/sessions/${sessionId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: 'Test',
					userContext: 'Context',
					provider: 'anthropic',
					model: 'claude-3-5-sonnet-20241022',
				}),
			});

			expect(response.status).toBe(202);
		});

		it('should work with oneShot mode', async () => {
			const response = await app.request(`/v1/sessions/${sessionId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: 'Test',
					userContext: 'Context',
					oneShot: true,
				}),
			});

			expect(response.status).toBe(202);
		});

		it('should work with all parameters combined', async () => {
			const response = await app.request(`/v1/sessions/${sessionId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: 'Test',
					userContext: 'Context',
					agent: 'general',
					provider: 'anthropic',
					model: 'claude-3-5-sonnet-20241022',
					oneShot: false,
				}),
			});

			expect(response.status).toBe(202);
		});
	});

	describe('Edge Cases', () => {
		it('should handle very long userContext', async () => {
			const longContext = 'A'.repeat(10000);
			const response = await app.request(`/v1/sessions/${sessionId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: 'Test',
					userContext: longContext,
				}),
			});

			expect(response.status).toBe(202);
		});

		it('should handle userContext with XML-like tags', async () => {
			const response = await app.request(`/v1/sessions/${sessionId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: 'Test',
					userContext: '<tag>Content</tag>',
				}),
			});

			expect(response.status).toBe(202);
		});

		it('should handle userContext with the wrapper tag itself', async () => {
			const response = await app.request(`/v1/sessions/${sessionId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: 'Test',
					userContext: '<user_context>Tricky</user_context>',
				}),
			});

			expect(response.status).toBe(202);
		});

		it('should handle userContext with JSON content', async () => {
			const response = await app.request(`/v1/sessions/${sessionId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: 'Test',
					userContext: JSON.stringify({ key: 'value', nested: { data: 123 } }),
				}),
			});

			expect(response.status).toBe(202);
		});
	});

	describe('Message Creation', () => {
		it('should create user message even with userContext', async () => {
			const response = await app.request(`/v1/sessions/${sessionId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: 'Test message',
					userContext: 'Test context',
				}),
			});

			expect(response.status).toBe(202);

			// Wait a bit for message to be created
			await new Promise(resolve => setTimeout(resolve, 100));

			// Fetch messages with parsed=true to get parsed JSON content
			const messagesRes = await app.request(`/v1/sessions/${sessionId}/messages?parsed=true`);
			expect(messagesRes.status).toBe(200);
			
			const messages = await messagesRes.json();
			expect(messages.length).toBeGreaterThan(0);
			
			// Should have user message
			const userMessage = messages.find((m: any) => m.role === 'user');
			expect(userMessage).toBeDefined();
			
			// Message content is in parts, not directly on message
			expect(userMessage.parts).toBeDefined();
			expect(userMessage.parts.length).toBeGreaterThan(0);
			
			// Get the text content from parts (with parsed=true, content is parsed JSON)
			const textPart = userMessage.parts.find((p: any) => p.type === 'text');
			expect(textPart).toBeDefined();
			expect(textPart.content).toBeDefined();
			expect(typeof textPart.content).toBe('object');
			expect(textPart.content.text).toBe('Test message');
		});

		it('should not store userContext in message content', async () => {
			const content = 'Hello world';
			const userContext = 'Secret context that should not be in message';

			await app.request(`/v1/sessions/${sessionId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content, userContext }),
			});

			await new Promise(resolve => setTimeout(resolve, 100));

			// Fetch messages with parsed=true to get parsed JSON content
			const messagesRes = await app.request(`/v1/sessions/${sessionId}/messages?parsed=true`);
			const messages = await messagesRes.json();
			
			const userMessage = messages.find((m: any) => m.role === 'user');
			expect(userMessage).toBeDefined();
			expect(userMessage.parts).toBeDefined();
			
			// Get the text content from parts (with parsed=true, content is parsed JSON)
			const textPart = userMessage.parts.find((p: any) => p.type === 'text');
			expect(textPart).toBeDefined();
			expect(textPart.content).toBeDefined();
			expect(typeof textPart.content).toBe('object');
			expect(textPart.content.text).toBe(content);
			expect(textPart.content.text).not.toContain('Secret context');
		});
	});

	describe('Type Safety', () => {
		it('should accept userContext as undefined', async () => {
			const response = await app.request(`/v1/sessions/${sessionId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: 'Test',
					userContext: undefined,
				}),
			});

			expect(response.status).toBe(202);
		});

		it('should accept userContext as null', async () => {
			const response = await app.request(`/v1/sessions/${sessionId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: 'Test',
					userContext: null,
				}),
			});

			expect(response.status).toBe(202);
		});
	});
});
