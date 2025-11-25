import { z } from 'zod';
import { callOpenRouter, DEFAULT_MODEL } from '../../utils/llm.js';

export class BaseAgent {
  constructor(schema, options) {
    this.schema = schema;
    this.context = options.context;
    this.systemPrompt = options.systemPrompt;
    this.apiKey = options.apiKey;
    this.model = options.model || DEFAULT_MODEL;
  }

  async invoke(messages) {
    try {
      // Add system prompt if not already included
      const messagesWithSystem = messages[0]?.role === 'system' 
        ? messages 
        : [{ role: 'system', content: this.systemPrompt }, ...messages];

      const response = await callOpenRouter(
        messagesWithSystem, 
        this.apiKey, 
        this.model
      );
      console.log("AI RAW RESPONSE:", response);

      // Validate with Zod schema
      const parsed = this.schema.parse(response);
      
      return this.schema.parse(response);
    } catch (error) {
      console.error('Agent invocation error:', error);
      
      // Re-throw with more context
      if (error.message.includes('OpenRouter API Error')) {
        throw new Error(`LLM Error: ${error.message}`);
      } else if (error.name === 'ZodError') {
        throw new Error(`Invalid response format from LLM: ${error.message}`);
      } else {
        throw new Error(`Agent error: ${error.message}`);
      }
    }
  }
}