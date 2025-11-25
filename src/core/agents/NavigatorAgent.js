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
    const systemPrompt = `You are a browser navigation agent. Your job is to:
1. Evaluate the previous action
2. Maintain memory of what you've done
3. Determine the next goal
4. Execute browser actions

Available actions:
- click: Click an element (requires index)
- type: Type text into an element (requires index and text)
- scroll: Scroll the page
- wait: Wait for page to load
- done: Task is complete

Always respond in JSON format.`;

    super(navigatorSchema, { ...options, systemPrompt });
  }

  async execute() {
    try {
      await this.context.emitEvent(Actors.NAVIGATOR, ExecutionState.STEP_START, 'Navigating...');

      // Add current page state to memory
      await this.addStateToMemory();

      const messages = this.context.messageManager.getMessages();
      const result = await this.invoke(messages);

      // Execute actions
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

    // Simplify state for LLM
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

        // Reset state message flag for next iteration
        this.context.stateMessageAdded = false;

        // Wait between actions
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