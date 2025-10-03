#!/usr/bin/env bun

/**
 * Basic CLI Bot Example
 * 
 * Demonstrates the simplest possible use of the AGI SDK:
 * - Model resolution
 * - Text generation
 * - Command-line interface
 * 
 * Usage:
 *   bun run index.ts "Your question here"
 *   PROVIDER=openai MODEL=gpt-4o bun run index.ts "Your question"
 */

import { generateText, resolveModel } from '@agi-cli/sdk';

async function main() {
  // Get question from command line arguments
  const question = process.argv[2];
  
  if (!question) {
    console.error('Usage: bun run index.ts "Your question here"');
    process.exit(1);
  }

  // Get provider and model from environment (or use defaults)
  const provider = (process.env.PROVIDER || 'anthropic') as any;
  const modelId = process.env.MODEL || 'claude-sonnet-4';

  console.log(`🤖 Using ${provider}/${modelId}...\\n`);

  try {
    // Resolve the model instance
    const model = await resolveModel(provider, modelId);

    // Generate a response
    const result = await generateText({
      model,
      prompt: question,
      temperature: 0.7,
    });

    // Output the result
    console.log(result.text);
    
    // Show usage stats if available
    if (result.usage) {
      console.log(`\\n📊 Tokens: ${result.usage.totalTokens} total (${result.usage.promptTokens} prompt, ${result.usage.completionTokens} completion)`);
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
