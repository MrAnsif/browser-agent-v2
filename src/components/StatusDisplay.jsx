import { Play, Pause, Square, Loader, CheckCircle, XCircle } from 'lucide-react';

export const StatusDisplay = ({ 
  status, 
  currentStep, 
  maxSteps,
  onPause, 
  onResume, 
  onStop,
  isPaused 
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return <Loader className="spin" size={20} />;
      case 'completed':
        return <CheckCircle size={20} style={{ color: '#10b981' }} />;
      case 'failed':
        return <XCircle size={20} style={{ color: '#ef4444' }} />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'idle':
        return 'Ready';
      case 'running':
        return 'Running';
      case 'paused':
        return 'Paused';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="status-display">
      <div className="status-header">
        <div className="status-info">
          {getStatusIcon()}
          <span className="status-text">{getStatusText()}</span>
        </div>
        <div className="status-progress">
          Step {currentStep} / {maxSteps}
        </div>
      </div>

      {status === 'running' || status === 'paused' ? (
        <div className="status-controls">
          {!isPaused ? (
            <button onClick={onPause} className="btn-secondary">
              <Pause size={16} />
              Pause
            </button>
          ) : (
            <button onClick={onResume} className="btn-secondary">
              <Play size={16} />
              Resume
            </button>
          )}
          <button onClick={onStop} className="btn-danger">
            <Square size={16} />
            Stop
          </button>
        </div>
      ) : null}

      <div className="progress-bar">
        <div 
          className="progress-fill"
          style={{ width: `${(currentStep / maxSteps) * 100}%` }}
        />
      </div>
    </div>
  );
};