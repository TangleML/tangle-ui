/**
 * Format date string to localized string
 */
const defaultFormat: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

export const formatDate = (date: string | Date, format = defaultFormat) => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleString("en-US", format);
};

/**
 * Format duration between two timestamps
 * @param startTime - Start timestamp string
 * @param endTime - End timestamp string
 * @returns Formatted duration string (e.g., "1h 23m 45s", "2m 30s", "45s")
 */
export const formatDuration = (startTime: string, endTime: string): string => {
  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime).getTime();
  const durationMs = endMs - startMs;

  if (durationMs < 0) return "Invalid duration";

  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
};

/**
 * Format relative time between a past date and now
 * @param date - past timestamp string
 * @returns Formatted relative string (e.g., "9:43am", "yesterday", "3 days ago")
 */
export const formatRelativeTime = (date: Date | null) => {
  if (!date) return null;
  const now = new Date();
  const past = new Date(date);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const pastDate = new Date(
    past.getFullYear(),
    past.getMonth(),
    past.getDate(),
  );

  const isSameDay = pastDate.getTime() === today.getTime();
  const isYesterday = pastDate.getTime() === yesterday.getTime();

  if (isSameDay) {
    return past.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else if (isYesterday) {
    return "yesterday";
  } else {
    const diffDays = Math.floor(
      (now.getTime() - past.getTime()) / (1000 * 60 * 60 * 24),
    );
    return `${diffDays} days ago`;
  }
};
