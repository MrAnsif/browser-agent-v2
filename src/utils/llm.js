/**
 * OpenRouter API Integration
 */

export async function callOpenRouter(messages, apiKey, model = 'openai/gpt-oss-20b:free') {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': chrome.runtime.getURL(''),
        'X-Title': 'AI Browser Agent'
      },
      body: JSON.stringify({
        "model": "openai/gpt-oss-20b:free",
        messages,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenRouter API Error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response from OpenRouter API');
    }

    let content = data.choices[0].message.content;
    
    // Clean up content
    content = content.trim();
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    content = content.trim();
    
    // Parse JSON response
    try {
      const parsed = JSON.parse(content);
      
      // Fix for Planner Agent - ensure all string fields exist
      if (parsed.observation !== undefined) {
        if (parsed.challenges === undefined || parsed.challenges === null) {
          parsed.challenges = 'None';
        }
        if (parsed.final_answer === undefined || parsed.final_answer === null) {
          parsed.final_answer = '';
        }
        if (parsed.next_steps === undefined || parsed.next_steps === null) {
          parsed.next_steps = '';
        }
        if (parsed.reasoning === undefined || parsed.reasoning === null) {
          parsed.reasoning = '';
        }
      }
      
      // Fix for Navigator Agent - ensure current_state and action exist
      if (parsed.current_state === undefined || parsed.current_state === null) {
        parsed.current_state = {
          evaluation_previous_goal: parsed.evaluation_previous_goal || 'Starting task',
          memory: parsed.memory || 'No previous actions',
          next_goal: parsed.next_goal || 'Analyzing page'
        };
      }
      
      if (parsed.action === undefined || parsed.action === null) {
        parsed.action = parsed.actions || [{ action_type: 'wait' }];
      }
      
      // Ensure action is an array
      if (!Array.isArray(parsed.action)) {
        parsed.action = [parsed.action];
      }
      
      return parsed;
    } catch (parseError) {
      console.error('Failed to parse JSON response:', content);
      throw new Error(`Invalid JSON from LLM: ${parseError.message}`);
    }
  } catch (error) {
    console.error('OpenRouter API call failed:', error);
    throw error;
  }
}

export const OPENROUTER_MODELS = {
  GPT4_TURBO: 'openai/gpt-4-turbo',
  GPT4: 'openai/gpt-4',
  GPT35_TURBO: 'openai/gpt-3.5-turbo',
  CLAUDE_SONNET: 'anthropic/claude-3.5-sonnet',
  CLAUDE_OPUS: 'anthropic/claude-3-opus',
  GEMINI_PRO: 'google/gemini-pro',
  LLAMA_70B: 'meta-llama/llama-3-70b-instruct',
};

export const DEFAULT_MODEL = OPENROUTER_MODELS.GPT4_TURBO;