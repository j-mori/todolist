/**
 * Formats an ISO timestamp into a locale-aware short date+time. Wire dates are
 * strings throughout; formatting happens at the UI edge only.
 */
const FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export const formatTaskTimestamp = (isoString: string): string => {
  const value = new Date(isoString);
  if (Number.isNaN(value.getTime())) return isoString;
  return FORMATTER.format(value);
};
