import { formatRelativeTime } from "@/utils/date";

export function ago(date: Date | null): string | undefined {
  return date ? formatRelativeTime(date) : undefined;
}
