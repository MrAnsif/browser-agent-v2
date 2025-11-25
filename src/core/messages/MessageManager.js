export class MessageManager {
  constructor(options = {}) {
    this.settings = {
      maxInputTokens: 128000,
      estimatedCharactersPerToken: 3,
      imageTokens: 800,
      ...options
    };
    
    this.history = {
      messages: [],
      totalTokens: 0
    };
  }

  initTaskMessages(systemPrompt, task, context = '') {
    // System message
    this.addMessage({
      role: 'system',
      content: systemPrompt
    });

    // Context if provided
    if (context) {
      this.addMessage({
        role: 'user',
        content: `Context for the task: ${context}`
      });
    }

    // Task instruction
    this.addMessage({
      role: 'user',
      content: `Your task: ${task}\n\nPlease complete this task step by step.`
    });

    // Example output
    this.addExampleOutput();

    // History marker
    this.addMessage({
      role: 'user',
      content: '[Task history starts here]'
    });
  }

  addExampleOutput() {
    this.addMessage({
      role: 'user',
      content: 'Example output format:'
    });

    this.addMessage({
      role: 'assistant',
      content: JSON.stringify({
        current_state: {
          evaluation_previous_goal: "Successfully navigated to the search page",
          memory: "Opened browser, searched for information",
          next_goal: "Click on the first search result"
        },
        action: [{ click_element: { index: 5 } }]
      }, null, 2)
    });
  }

  addMessage(message) {
    const tokens = this.countTokens(message);
    this.history.messages.push({
      message,
      metadata: { tokens, timestamp: Date.now() }
    });
    this.history.totalTokens += tokens;
    this.trimIfNeeded();
  }

  addStateMessage(state) {
    this.addMessage({
      role: 'user',
      content: `Current page state:\n${JSON.stringify(state, null, 2)}`
    });
  }

  getMessages() {
    return this.history.messages.map(m => m.message);
  }

  countTokens(message) {
    if (Array.isArray(message.content)) {
      return message.content.reduce((total, item) => {
        if (item.type === 'image_url') return total + this.settings.imageTokens;
        if (item.type === 'text') {
          return total + Math.floor(item.text.length / this.settings.estimatedCharactersPerToken);
        }
        return total;
      }, 0);
    }
    return Math.floor(message.content.length / this.settings.estimatedCharactersPerToken);
  }

  trimIfNeeded() {
    const excess = this.history.totalTokens - this.settings.maxInputTokens;
    if (excess <= 0) return;

    const lastMsg = this.history.messages[this.history.messages.length - 1];

    // Remove images first
    if (Array.isArray(lastMsg.message.content)) {
      lastMsg.message.content = lastMsg.message.content.filter(item => {
        if (item.type === 'image_url') {
          this.history.totalTokens -= this.settings.imageTokens;
          lastMsg.metadata.tokens -= this.settings.imageTokens;
          return false;
        }
        return true;
      });
    }

    // Trim text if still over limit
    if (this.history.totalTokens > this.settings.maxInputTokens) {
      const proportion = excess / lastMsg.metadata.tokens;
      const content = typeof lastMsg.message.content === 'string' 
        ? lastMsg.message.content 
        : lastMsg.message.content.map(c => c.text).join('');
      
      const trimmed = content.slice(0, -Math.floor(content.length * proportion));
      
      this.history.messages.pop();
      this.addMessage({ ...lastMsg.message, content: trimmed });
    }
  }

  reset() {
    this.history = {
      messages: [],
      totalTokens: 0
    };
  }
}