export type ValidationError = {
  kind: 'ValidationError';
  field: string;
  reason: string;
};

export type TaskNotFound = {
  kind: 'TaskNotFound';
  id: string;
};

export type DomainError = ValidationError | TaskNotFound;

export const validationError = (field: string, reason: string): ValidationError => ({
  kind: 'ValidationError',
  field,
  reason,
});

export const taskNotFound = (id: string): TaskNotFound => ({
  kind: 'TaskNotFound',
  id,
});
