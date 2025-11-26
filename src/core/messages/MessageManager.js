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

    // Example output with CORRECT format
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
      content: 'Example of correct JSON response format:'
    });

    // Example 1: Click action
    this.addMessage({
      role: 'assistant',
      content: JSON.stringify({
        current_state: {
          evaluation_previous_goal: "Page loaded successfully, search input is visible",
          memory: "Navigated to Google homepage",
          next_goal: "Click on the search input field to start typing"
        },
        action: [
          {
            action_type: "click",
            index: 2,
            reasoning: "Clicking search input at index 2 to focus it"
          }
        ]
      }, null, 2)
    });

    // Example 2: Type action
    this.addMessage({
      role: 'user',
      content: 'Another example with typing:'
    });

    this.addMessage({
      role: 'assistant',
      content: JSON.stringify({
        current_state: {
          evaluation_previous_goal: "Successfully clicked search input, now it's focused",
          memory: "Navigated to Google, clicked search input",
          next_goal: "Type the search query into the focused input"
        },
        action: [
          {
            action_type: "type",
            index: 2,
            text: "artificial intelligence",
            reasoning: "Typing search query into the focused input field"
          }
        ]
      }, null, 2)
    });

    // Example 3: Multiple actions
    this.addMessage({
      role: 'user',
      content: 'Example with scroll action:'
    });

    this.addMessage({
      role: 'assistant',
      content: JSON.stringify({
        current_state: {
          evaluation_previous_goal: "Typed search query successfully",
          memory: "Navigated to Google, clicked input, typed search query",
          next_goal: "Scroll down to see more options or find search button"
        },
        action: [
          {
            action_type: "scroll",
            reasoning: "Need to see more elements on the page"
          }
        ]
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
    const stateText = `CURRENT PAGE STATE:
URL: ${state.url}
Title: ${state.title}

Interactive Elements (${state.interactiveElements?.length || 0} total):
${state.interactiveElements?.map(el =>
      `Index ${el.index}: <${el.tag}> ${el.text ? `"${el.text.slice(0, 50)}"` : ''} ${JSON.stringify(el.attributes)}`
    ).join('\n') || 'No interactive elements found'}

Analyze the above state and decide what action to take next.`;

    this.addMessage({
      role: 'user',
      content: stateText
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