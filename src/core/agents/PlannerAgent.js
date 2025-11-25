import { z } from 'zod';
import { BaseAgent } from './BaseAgent.js';
import { Actors, ExecutionState } from '../events/EventManager.js';

const plannerSchema = z.object({
  observation: z.string(),
  challenges: z.string(),
  done: z.boolean(),
  next_steps: z.string(),
  final_answer: z.string(),
  reasoning: z.string()
});

export class PlannerAgent extends BaseAgent {
  constructor(options) {
    const systemPrompt = `You are a task planning agent. 

CRITICAL: You MUST respond with a valid JSON object only. No markdown, no code blocks, just raw JSON.

Required JSON structure:
{
  "observation": "string describing what you observe",
  "challenges": "string describing current obstacles or 'None' if no challenges",
  "done": true or false,
  "next_steps": "string describing what to do next or 'Task complete' if done",
  "final_answer": "string with final result or empty string '' if not done",
  "reasoning": "string explaining your thought process"
}

Rules:
1. ALL fields are required and must be strings (except 'done' which is boolean)
2. If a field doesn't apply, use empty string "" or "None"
3. If done is false, final_answer should be empty string ""
4. If done is true, final_answer must contain the result
5. Never use null or undefined values

Your job:
- Observe the current state
- Identify challenges (or say "None")
- Determine if task is complete (done: true/false)
- Plan next steps
- Provide reasoning`;

    super(plannerSchema, { ...options, systemPrompt });
  }

  async execute() {
    try {
      await this.context.emitEvent(Actors.PLANNER, ExecutionState.STEP_START, 'Planning...');

      const messages = this.context.messageManager.getMessages();
      const result = await this.invoke(messages);

      const eventMsg = result.done ? result.final_answer : result.next_steps;
      await this.context.emitEvent(Actors.PLANNER, ExecutionState.STEP_OK, eventMsg);

      if (result.done) {
        this.context.finalAnswer = result.final_answer;
      }

      return result;
    } catch (error) {
      await this.context.emitEvent(
        Actors.PLANNER, 
        ExecutionState.STEP_FAIL, 
        error.message
      );
      throw error;
    }
  }
}