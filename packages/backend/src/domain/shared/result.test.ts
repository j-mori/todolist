import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { err, ok, type Result } from './result.ts';

describe('Result', () => {
  it('ok wraps a value as a success variant', () => {
    const r = ok(42);
    assert.deepEqual(r, { ok: true, value: 42 });
  });

  it('err wraps a value as a failure variant', () => {
    const r = err({ kind: 'Boom' });
    assert.deepEqual(r, { ok: false, error: { kind: 'Boom' } });
  });

  it('narrows on the discriminant so .value and .error are reachable without casts', () => {
    const r: Result<number, { kind: 'Bad' }> = ok(7);

    if (r.ok) {
      const doubled: number = r.value * 2;
      assert.equal(doubled, 14);
    } else {
      assert.fail('expected ok');
    }

    const e: Result<number, { kind: 'Bad' }> = err({ kind: 'Bad' });
    if (!e.ok) {
      const kind: 'Bad' = e.error.kind;
      assert.equal(kind, 'Bad');
    } else {
      assert.fail('expected err');
    }
  });
});
