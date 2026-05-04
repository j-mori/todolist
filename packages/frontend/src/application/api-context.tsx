import { createContext, type ReactNode, useContext } from 'react';
import type { TasksApi } from '../adapters/api/tasks-api.ts';

const TasksApiContext = createContext<TasksApi | null>(null);

export const TasksApiProvider = ({ value, children }: { value: TasksApi; children: ReactNode }) => (
  <TasksApiContext.Provider value={value}>{children}</TasksApiContext.Provider>
);

export const useTasksApi = (): TasksApi => {
  const value = useContext(TasksApiContext);
  if (value === null) {
    throw new Error('useTasksApi must be used inside <TasksApiProvider>');
  }
  return value;
};
