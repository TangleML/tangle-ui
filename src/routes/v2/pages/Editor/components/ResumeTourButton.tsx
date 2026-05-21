import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useTours } from "@/providers/TourProvider";
import { tracking } from "@/utils/tracking";

export function ResumeTourButton() {
  const { pausedTour, resumeTour, dismissPausedTour } = useTours();

  if (!pausedTour) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex items-center gap-1 rounded-full bg-stone-900 text-white shadow-lg pl-3 pr-1 py-1">
      <Icon name="Play" size="sm" aria-hidden="true" />
      <button
        type="button"
        onClick={() => {
          void resumeTour();
        }}
        className="text-sm font-medium px-2 py-1 hover:underline"
        {...tracking("learning_hub.tours.resume", {
          tour_id: pausedTour.tourId,
        })}
      >
        Resume tour
      </button>
      <Button
        variant="ghost"
        size="min"
        className="text-stone-300 hover:text-white hover:bg-stone-700 rounded-full"
        aria-label="Dismiss paused tour"
        onClick={() => {
          void dismissPausedTour();
        }}
        {...tracking("learning_hub.tours.dismiss_paused", {
          tour_id: pausedTour.tourId,
        })}
      >
        <Icon name="X" size="sm" aria-hidden="true" />
      </Button>
    </div>
  );
}
