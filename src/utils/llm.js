/**
 * OpenRouter API Integration
 * Docs: https://openrouter.ai/docs
 */

export async function callOpenRouter(messages, apiKey, model = 'openai/gpt-4-turbo') {
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
                // model,
                "model": "openai/gpt-oss-20b:free",
                messages,
                temperature: 0.7,
                response_format: { type: 'json_object' }
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

        const content = data.choices[0].message.content;

        // Parse JSON response
        try {
            return JSON.parse(content);
        } catch (parseError) {
            // If response isn't valid JSON, try to extract JSON from markdown code blocks
            const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[1]);
            }

            // Try to parse as-is
            return JSON.parse(content);
        }
    } catch (error) {
        console.error('OpenRouter API call failed:', error);
        throw error;
    }
}

/**
 * Available OpenRouter models
 * You can change the default model here
 */
export const OPENROUTER_MODELS = {
    GPT4_TURBO: 'openai/gpt-4-turbo',
    GPT4: 'openai/gpt-4',
    GPT35_TURBO: 'openai/gpt-3.5-turbo',
    CLAUDE_SONNET: 'anthropic/claude-3.5-sonnet',
    CLAUDE_OPUS: 'anthropic/claude-3-opus',
    GEMINI_PRO: 'google/gemini-pro',
    LLAMA_70B: 'meta-llama/llama-3-70b-instruct',
};

// Default model to use
export const DEFAULT_MODEL = OPENROUTER_MODELS.GPT4_TURBO;