import { AgentEvent } from '../events/EventManager.js';

export const DEFAULT_OPTIONS = {
  maxSteps: 100,
  maxActionsPerStep: 10,
  maxFailures: 3,
  useVision: false,
  useVisionForPlanner: true,
  planningInterval: 3
};

export class AgentContext {
  constructor(taskId, browserContext, messageManager, eventManager, options = {}) {
    this.controller = new AbortController();
    this.taskId = taskId;
    this.browserContext = browserContext;
    this.messageManager = messageManager;
    this.eventManager = eventManager;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    this.paused = false;
    this.stopped = false;
    this.nSteps = 0;
    this.consecutiveFailures = 0;
    this.actionResults = [];
    this.stateMessageAdded = false;
    this.history = [];
    this.finalAnswer = null;
  }

  async emitEvent(actor, state, details) {
    const event = new AgentEvent(actor, state, {
      taskId: this.taskId,
      step: this.nSteps,
      maxSteps: this.options.maxSteps,
      details
    });
    await this.eventManager.emit(event);
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  stop() {
    this.stopped = true;
    setTimeout(() => this.controller.abort(), 300);
  }

  reset() {
    this.paused = false;
    this.stopped = false;
    this.nSteps = 0;
    this.consecutiveFailures = 0;
    this.actionResults = [];
    this.stateMessageAdded = false;
    this.finalAnswer = null;
  }
}