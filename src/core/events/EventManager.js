export class EventManager {
  constructor() {
    this.subscribers = new Map();
  }

  subscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType).push(callback);
  }

  unsubscribe(eventType, callback) {
    const callbacks = this.subscribers.get(eventType);
    if (callbacks) {
      this.subscribers.set(
        eventType,
        callbacks.filter(cb => cb !== callback)
      );
    }
  }

  async emit(event) {
    const callbacks = this.subscribers.get(event.type) || [];
    await Promise.all(callbacks.map(cb => cb(event)));
  }
}

export const EventType = {
  EXECUTION: 'execution'
};

export const ExecutionState = {
  TASK_START: 'task.start',
  TASK_OK: 'task.ok',
  TASK_FAIL: 'task.fail',
  TASK_PAUSE: 'task.pause',
  TASK_RESUME: 'task.resume',
  TASK_CANCEL: 'task.cancel',
  STEP_START: 'step.start',
  STEP_OK: 'step.ok',
  STEP_FAIL: 'step.fail',
  ACT_START: 'act.start',
  ACT_OK: 'act.ok',
  ACT_FAIL: 'act.fail'
};

export const Actors = {
  SYSTEM: 'system',
  PLANNER: 'planner',
  NAVIGATOR: 'navigator'
};

export class AgentEvent {
  constructor(actor, state, data) {
    this.type = EventType.EXECUTION;
    this.actor = actor;
    this.state = state;
    this.data = data;
    this.timestamp = Date.now();
  }
}