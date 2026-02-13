import { format, isValid, parseISO } from "date-fns"

export function formatDateToISO(value: string | Date): string {
  const date = value instanceof Date ? value : parseISO(value)
  if (!isValid(date)) {
    return value instanceof Date ? format(value, "yyyy-MM-dd") : value
  }
  return format(date, "yyyy-MM-dd")
}
