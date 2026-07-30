/**
 * Formats a Date object or string/number representation of a date
 * into Indian Standard Time (IST) in the format: DD/MM/YYYY, HH:MM:SS AM/PM IST
 */
export function formatToIST(date: Date | string | number): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return 'N/A';

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
    .formatToParts(d)
    .reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {} as Record<string, string>);

  const day = parts.day;
  const month = parts.month;
  const year = parts.year;
  const hour = parts.hour;
  const minute = parts.minute;
  const second = parts.second;
  const dayPeriod = parts.dayPeriod ? parts.dayPeriod.toUpperCase() : '';

  return `${day}/${month}/${year}, ${hour}:${minute}:${second} ${dayPeriod} IST`;
}
