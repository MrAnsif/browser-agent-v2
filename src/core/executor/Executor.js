import { Actors, ExecutionState } from '../events/EventManager.js';
import { PlannerAgent } from '../agents/PlannerAgent.js';
import { NavigatorAgent } from '../agents/NavigatorAgent.js';
import { DEFAULT_MODEL } from '../../utils/llm.js';

export class Executor {
  constructor(task, taskId, browserContext, messageManager, eventManager, options) {
    this.task = task;
    this.taskId = taskId;
    this.browserContext = browserContext;
    this.messageManager = messageManager;
    this.eventManager = eventManager;
    this.options = options;

    this.planner = null;
    this.navigator = null;
    this.context = null;
  }

  async execute(apiKey, model = DEFAULT_MODEL) {
    try {
      const { AgentContext } = await import('../context/AgentContext.js');
      
      this.context = new AgentContext(
        this.taskId,
        this.browserContext,
        this.messageManager,
        this.eventManager,
        this.options
      );

      // Initialize agents with OpenRouter
      this.planner = new PlannerAgent({
        context: this.context,
        apiKey,
        model
      });

      this.navigator = new NavigatorAgent({
        context: this.context,
        apiKey,
        model
      });

      // Initialize messages
      this.messageManager.initTaskMessages(
        this.planner.systemPrompt,
        this.task
      );

      await this.context.emitEvent(Actors.SYSTEM, ExecutionState.TASK_START, this.taskId);

      let latestPlan = null;
      let step = 0;

      for (step = 0; step < this.context.options.maxSteps; step++) {
        if (this.context.stopped) break;

        this.context.nSteps = step;

        // Run planner periodically
        if (step % this.context.options.planningInterval === 0) {
          latestPlan = await this.planner.execute();

          if (latestPlan.done) {
            await this.context.emitEvent(
              Actors.SYSTEM,
              ExecutionState.TASK_OK,
              latestPlan.final_answer
            );
            return { success: true, result: latestPlan.final_answer };
          }
        }

        // Execute navigator
        const navResult = await this.navigator.execute();

        // Check if any action indicated completion
        const doneAction = this.context.actionResults.find(r => r.isDone);
        if (doneAction) {
          latestPlan = await this.planner.execute();
          if (latestPlan.done) {
            await this.context.emitEvent(
              Actors.SYSTEM,
              ExecutionState.TASK_OK,
              latestPlan.final_answer
            );
            return { success: true, result: latestPlan.final_answer };
          }
        }

        // Check for pause
        while (this.context.paused && !this.context.stopped) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Max steps reached
      await this.context.emitEvent(
        Actors.SYSTEM,
        ExecutionState.TASK_FAIL,
        'Max steps reached'
      );
      return { success: false, error: 'Max steps reached' };

    } catch (error) {
      await this.context.emitEvent(
        Actors.SYSTEM,
        ExecutionState.TASK_FAIL,
        error.message
      );
      return { success: false, error: error.message };
    }
  }

  pause() {
    if (this.context) this.context.pause();
  }

  resume() {
    if (this.context) this.context.resume();
  }

  stop() {
    if (this.context) this.context.stop();
  }
}