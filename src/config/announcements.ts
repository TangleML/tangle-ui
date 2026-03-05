export interface Announcement {
  id: string;
  title: string;
  body: string;
  variant?: "warning" | "info" | "success" | "error";
  dismissible?: boolean;
  expiresAt?: string; // ISO date string, e.g. "2026-04-01"
}

declare global {
  interface Window {
    __TANGLE_ANNOUNCEMENTS__?: Announcement[];
  }
}
