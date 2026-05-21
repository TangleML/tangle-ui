const PAUSED_TOUR_KEY = "tour-paused-state";

export interface PausedTourState {
  tourId: string;
  step: number;
  pipelineName?: string;
  fileId?: string;
}

export function readPausedTour(): PausedTourState | null {
  try {
    const raw = localStorage.getItem(PAUSED_TOUR_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PausedTourState;
    if (
      typeof parsed?.tourId === "string" &&
      typeof parsed?.step === "number"
    ) {
      return parsed;
    }
  } catch {
    // fall through
  }
  return null;
}

export function writePausedTour(state: PausedTourState | null): void {
  try {
    if (state === null) {
      localStorage.removeItem(PAUSED_TOUR_KEY);
    } else {
      localStorage.setItem(PAUSED_TOUR_KEY, JSON.stringify(state));
    }
  } catch {
    // ignore
  }
}
