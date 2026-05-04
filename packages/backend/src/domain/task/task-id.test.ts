import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { TaskId } from './task-id.ts';

const VALID_V4 = '550e8400-e29b-41d4-a716-446655440000';
const VALID_V4_ALT = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const V1_UUID = 'c232ab00-9414-11ec-b909-0242ac120002';

describe('TaskId', () => {
  it('accepts a valid UUID v4', () => {
    const r = TaskId.from(VALID_V4);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.value, VALID_V4);
  });

  it('rejects an empty string', () => {
    const r = TaskId.from('');
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.error.kind, 'ValidationError');
      assert.equal(r.error.field, 'id');
    }
  });

  it('rejects a non-UUID string', () => {
    const r = TaskId.from('not-a-uuid');
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.field, 'id');
  });

  it('rejects a UUID of the wrong version (v1)', () => {
    const r = TaskId.from(V1_UUID);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.field, 'id');
  });

  it('produces structurally equal values for the same input', () => {
    const a = TaskId.from(VALID_V4);
    const b = TaskId.from(VALID_V4);
    assert.equal(a.ok && b.ok && a.value === b.value, true);
  });

  it('produces distinct values for different inputs', () => {
    const a = TaskId.from(VALID_V4);
    const b = TaskId.from(VALID_V4_ALT);
    assert.equal(a.ok && b.ok && a.value !== b.value, true);
  });
});
