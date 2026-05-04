import type { Clock } from '../ports/clock.ts';

export type FixedClock = Clock & {
  readonly nowCalls: number;
  set(date: Date): void;
  advance(ms: number): void;
};

export const createFixedClock = (initial: Date): FixedClock => {
  let current = new Date(initial.getTime());
  let calls = 0;

  return {
    get nowCalls() {
      return calls;
    },
    now() {
      calls++;
      return new Date(current.getTime());
    },
    set(date) {
      current = new Date(date.getTime());
    },
    advance(ms) {
      current = new Date(current.getTime() + ms);
    },
  };
};
