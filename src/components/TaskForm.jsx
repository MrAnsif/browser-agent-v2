import { useState } from 'react';
import { Key, Send } from 'lucide-react';

export const TaskForm = ({ onSubmit, disabled }) => {
  const [task, setTask] = useState('scroll down');
  const [apiKey, setApiKey] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (task.trim() && apiKey.trim()) {
      onSubmit(task, apiKey);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="task-form">
      <div className="form-group">
        <label>
          <Key size={16} />
          OpenRouter API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-or-v1-..."
          disabled={disabled}
          required
        />
        <small style={{ color: '#6b7280', fontSize: '12px' }}>
          Get your API key from{' '}
          <a 
            href="https://openrouter.ai/keys" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#3b82f6' }}
          >
            openrouter.ai/keys
          </a>
        </small>
      </div>

      <div className="form-group">
        <label>Task Description</label>
        <textarea
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Example: Search for 'React tutorials' on Google and click the first result"
          rows={4}
          disabled={disabled}
          required
        />
      </div>

      <button type="submit" disabled={disabled} className="btn-primary">
        <Send size={16} />
        Start Task
      </button>
    </form>
  );
};