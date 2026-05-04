export type TaskStatus = 'pending' | 'completed';

const isPending = (s: TaskStatus): boolean => s === 'pending';
const isCompleted = (s: TaskStatus): boolean => s === 'completed';

export const TaskStatus = { isPending, isCompleted };
