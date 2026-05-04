import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { TaskStatus } from './task-status.ts';

describe('TaskStatus', () => {
  it('isPending is true for pending and false for completed', () => {
    assert.equal(TaskStatus.isPending('pending'), true);
    assert.equal(TaskStatus.isPending('completed'), false);
  });

  it('isCompleted is true for completed and false for pending', () => {
    assert.equal(TaskStatus.isCompleted('completed'), true);
    assert.equal(TaskStatus.isCompleted('pending'), false);
  });
});
