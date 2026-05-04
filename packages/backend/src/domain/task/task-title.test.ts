import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { TaskTitle } from './task-title.ts';

describe('TaskTitle', () => {
  it('accepts a non-empty string within the length limit', () => {
    const r = TaskTitle.from('Buy milk');
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.value, 'Buy milk');
  });

  it('trims surrounding whitespace before validation', () => {
    const r = TaskTitle.from('   Buy milk   ');
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.value, 'Buy milk');
  });

  it('rejects an empty string', () => {
    const r = TaskTitle.from('');
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.error.field, 'title');
      assert.match(r.error.reason, /empty/i);
    }
  });

  it('rejects a whitespace-only string', () => {
    const r = TaskTitle.from('   \t\n  ');
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error.reason, /empty/i);
  });

  it('accepts exactly 200 characters', () => {
    const r = TaskTitle.from('x'.repeat(200));
    assert.equal(r.ok, true);
  });

  it('rejects more than 200 characters (after trim)', () => {
    const r = TaskTitle.from('x'.repeat(201));
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error.reason, /200/);
  });

});
