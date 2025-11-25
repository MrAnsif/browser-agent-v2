import { useExecutor } from '../hooks/useExecutor';
import { TaskForm } from './TaskForm';
import { StatusDisplay } from './StatusDisplay';
import { ScrollText } from 'lucide-react';

export const TaskExecutor = () => {
  const {
    start,
    pause,
    resume,
    stop,
    isRunning,
    isPaused,
    logs,
    currentStep,
    status
  } = useExecutor();

  const handleStartTask = async (task, apiKey) => {
    await start(task, apiKey);
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getLogColor = (state) => {
    if (state.includes('ok')) return '#10b981';
    if (state.includes('fail')) return '#ef4444';
    if (state.includes('start')) return '#3b82f6';
    return '#6b7280';
  };

  return (
    <div className="task-executor">
      <div className="header">
        <h1>AI Browser Agent</h1>
        <p>Automate browser tasks with AI</p>
      </div>

      <TaskForm 
        onSubmit={handleStartTask} 
        disabled={isRunning}
      />

      {(isRunning || status === 'completed' || status === 'failed') && (
        <StatusDisplay
          status={status}
          currentStep={currentStep}
          maxSteps={100}
          onPause={pause}
          onResume={resume}
          onStop={stop}
          isPaused={isPaused}
        />
      )}

      {logs.length > 0 && (
        <div className="logs-container">
          <div className="logs-header">
            <ScrollText size={16} />
            <span>Execution Logs</span>
          </div>
          <div className="logs">
            {logs.map((log, index) => (
              <div key={index} className="log-entry">
                <span className="log-time">{formatTimestamp(log.timestamp)}</span>
                <span 
                  className="log-actor"
                  style={{ color: getLogColor(log.state) }}
                >
                  [{log.actor}]
                </span>
                <span className="log-state">{log.state}</span>
                <span className="log-details">{log.details}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};