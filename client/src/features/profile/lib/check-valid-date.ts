import { isBefore, isValid as isValidDate } from "date-fns";

export function checkValidDate(date: string | Date): boolean {
  if (!isValidDate(new Date(date))) return false;
  const targetDate = new Date("1900-01-01");
  if (isBefore(new Date(date), targetDate)) return false;
  return true;
}
