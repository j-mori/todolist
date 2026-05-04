export type ClassValue = string | false | null | undefined;

/** Tiny class-name joiner. Filters falsy values, joins with a space. */
export const cn = (...values: readonly ClassValue[]): string =>
  values.filter((value): value is string => typeof value === 'string' && value.length > 0).join(' ');
