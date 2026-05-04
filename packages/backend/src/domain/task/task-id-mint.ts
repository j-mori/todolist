import { __unsafeTaskId, type TaskId } from './task-id.ts';

/**
 * Mint a {@link TaskId} from a string the caller has already validated as a
 * UUID v4 (typically `crypto.randomUUID()` or a deterministic test generator).
 *
 * Validation is bypassed for performance — `IdGenerator` implementations call
 * this on every `addTask`. Sources that may produce an invalid UUID must use
 * `TaskId.from` instead.
 */
export const mintTaskId = (rawUuidV4: string): TaskId => __unsafeTaskId(rawUuidV4);
