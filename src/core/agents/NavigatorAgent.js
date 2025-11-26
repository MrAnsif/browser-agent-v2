import { z } from 'zod';
import { BaseAgent } from './BaseAgent.js';
import { Actors, ExecutionState } from '../events/EventManager.js';

const navigatorSchema = z.object({
  current_state: z.object({
    evaluation_previous_goal: z.string(),
    memory: z.string(),
    next_goal: z.string()
  }),
  action: z.array(z.object({
    action_type: z.enum(['click', 'type', 'scroll', 'wait', 'done']),
    index: z.number().optional(),
    text: z.string().optional()
  }))
});

export class NavigatorAgent extends BaseAgent {
  constructor(options) {
    const systemPrompt = `You are a browser navigation agent.

CRITICAL: You MUST respond with a valid JSON object only. No markdown, no code blocks, just raw JSON.

Required JSON structure:
{
  "current_state": {
    "evaluation_previous_goal": "string evaluating the previous action",
    "memory": "string summarizing what has been done so far",
    "next_goal": "string describing the next goal"
  },
  "action": [
    {
      "action_type": "click" | "type" | "scroll" | "wait" | "done",
      "index": number (only for click/type),
      "text": "string" (only for type)
    }
  ]
}

Available actions:
- click: Click an element (requires index number)
- type: Type text into an element (requires index number and text string)
- scroll: Scroll the page down
- wait: Wait 2 seconds for page to load
- done: Mark task as complete

Rules:
1. ALL fields in current_state must be non-empty strings
2. action array must contain at least one action object
3. For click action: provide index only
4. For type action: provide both index and text
5. Never use null or undefined values
6. Make sure to 'current_state' as object 
6. Make sure to 'action' as array 

Your job:
1. Evaluate if the previous action succeeded
2. Maintain memory of all actions taken
3. Determine the next goal
4. Choose the appropriate action to take`;

    super(navigatorSchema, { ...options, systemPrompt });
  }

  async execute() {
    try {
      await this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.STEP_START, 'Navigating...');

      await this.addStateToMemory();

      // this.context.messageManager.reset();
      const messages = this.context.messageManager.getMessages();
      const result = await this.invoke(messages);

      console.log('action at navAgent: ', result)

      const actionResults = await this.executeActions(result.action);
      this.context.actionResults = actionResults;

      await this.context.emitEvent(
        Actors.NAVIGATOR, 
        ExecutionState.STEP_OK, 
        result.current_state.next_goal
      );

      return result;
    } catch (error) {
      await this.context.emitEvent(
        Actors.NAVIGATOR, 
        ExecutionState.STEP_FAIL, 
        error.message
      );
      throw error;
    }
  }

  async addStateToMemory() {
    if (this.context.stateMessageAdded) return;

    const state = await this.context.browserContext.getState(
      this.context.options.useVision
    );

    const simplifiedState = {
      url: state.viewport.url,
      title: state.viewport.title,
      interactiveElements: Array.from(state.selectorMap.entries()).map(([index, el]) => ({
        index,
        tag: el.tagName,
        text: el.text || '',
        attributes: el.attributes
      }))
    };

    this.context.messageManager.addStateMessage(simplifiedState);
    this.context.stateMessageAdded = true;
  }

  async executeActions(actions) {
    const results = [];

    for (const action of actions) {
      try {
        if (this.context.paused || this.context.stopped) break;

        await this.context.emitEvent(
          Actors.NAVIGATOR,
          ExecutionState.ACT_START,
          `Executing ${action.action_type}`
        );

        let result = { success: false };

        switch (action.action_type) {
          case 'click':
            await this.context.browserContext.clickElement(action.index);
            result = { success: true, action: 'click', index: action.index };
            break;

          case 'type':
            await this.context.browserContext.typeText(action.index, action.text);
            result = { success: true, action: 'type', index: action.index, text: action.text };
            break;

          case 'scroll':
            await chrome.scripting.executeScript({
              target: { tabId: this.context.browserContext.tabId },
              func: () => window.scrollBy(0, window.innerHeight * 0.8)
            });
            result = { success: true, action: 'scroll' };
            break;

          case 'wait':
            await new Promise(resolve => setTimeout(resolve, 2000));
            result = { success: true, action: 'wait' };
            break;

          case 'done':
            result = { success: true, action: 'done', isDone: true };
            break;
        }

        results.push(result);

        await this.context.emitEvent(
          Actors.NAVIGATOR,
          ExecutionState.ACT_OK,
          `Completed ${action.action_type}`
        );

        this.context.stateMessageAdded = false;

        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        await this.context.emitEvent(
          Actors.NAVIGATOR,
          ExecutionState.ACT_FAIL,
          error.message
        );
        results.push({ success: false, error: error.message });
      }
    }

    return results;
  }
}