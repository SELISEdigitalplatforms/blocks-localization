/** Matches `formatFullDate` from monolith `src/lib/utils.ts`. */

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatFullDate(date: Date, withoutTime?: boolean): string {
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const dateStr = `${monthNames[date.getMonth()]} ${pad(date.getDate())}, ${date.getFullYear()}`;
  const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (withoutTime) return dateStr;
  return `${dateStr} at ${timeStr}`;
}
