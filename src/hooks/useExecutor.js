import { useState, useCallback, useRef } from 'react';
import { Executor } from '../core/executor/Executor.js';
import { MessageManager } from '../core/messages/MessageManager.js';
import { EventManager } from '../core/events/EventManager.js';
import { BrowserContext } from '../core/browser/BrowserContext.js';
import { DEFAULT_OPTIONS } from '../core/context/AgentContext.js';

export const useExecutor = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [status, setStatus] = useState('idle'); // idle, running, paused, completed, failed
  
  const executorRef = useRef(null);
  const eventManagerRef = useRef(new EventManager());

  const initialize = useCallback(async (task, apiKey) => {
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      const taskId = `task_${Date.now()}`;
      const browserContext = new BrowserContext(tab.id);
      const messageManager = new MessageManager();
      
      // Subscribe to events
      eventManagerRef.current.subscribe('execution', (event) => {
        setLogs(prev => [...prev, {
          timestamp: event.timestamp,
          actor: event.actor,
          state: event.state,
          details: event.data.details
        }]);

        setCurrentStep(event.data.step);

        if (event.state === 'task.start') {
          setStatus('running');
          setIsRunning(true);
        } else if (event.state === 'task.ok') {
          setStatus('completed');
          setIsRunning(false);
        } else if (event.state === 'task.fail') {
          setStatus('failed');
          setIsRunning(false);
        } else if (event.state === 'task.pause') {
          setStatus('paused');
          setIsPaused(true);
        } else if (event.state === 'task.resume') {
          setStatus('running');
          setIsPaused(false);
        }
      });

      executorRef.current = new Executor(
        task,
        taskId,
        browserContext,
        messageManager,
        eventManagerRef.current,
        DEFAULT_OPTIONS
      );

      return { success: true };
    } catch (error) {
      console.error('Initialization error:', error);
      return { success: false, error: error.message };
    }
  }, []);

  const start = useCallback(async (task, apiKey) => {
    setLogs([]);
    setCurrentStep(0);
    
    const initResult = await initialize(task, apiKey);
    if (!initResult.success) {
      setStatus('failed');
      setLogs(prev => [...prev, {
        timestamp: Date.now(),
        actor: 'system',
        state: 'error',
        details: initResult.error
      }]);
      return initResult;
    }

    const result = await executorRef.current.execute(apiKey);
    return result;
  }, [initialize]);

  const pause = useCallback(() => {
    if (executorRef.current) {
      executorRef.current.pause();
      setIsPaused(true);
      setStatus('paused');
    }
  }, []);

  const resume = useCallback(() => {
    if (executorRef.current) {
      executorRef.current.resume();
      setIsPaused(false);
      setStatus('running');
    }
  }, []);

  const stop = useCallback(() => {
    if (executorRef.current) {
      executorRef.current.stop();
      setIsRunning(false);
      setIsPaused(false);
      setStatus('idle');
    }
  }, []);

  return {
    start,
    pause,
    resume,
    stop,
    isRunning,
    isPaused,
    logs,
    currentStep,
    status
  };
};