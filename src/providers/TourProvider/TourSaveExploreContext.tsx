import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useState,
} from "react";

import {
  createRequiredContext,
  useRequiredContext,
} from "@/hooks/useRequiredContext";

export interface TourSaveExploreValue {
  // The save-as-pipeline dialog is mounted inside the editor (a route-level
  // descendant), while the completion popover renders under ReactourProvider at
  // the app root. They share this root-level context instead of a module
  // singleton so the popover's "Save demo pipeline" button reacts to the dialog
  // mounting rather than depending on effect/mount ordering.
  available: boolean;
  setAvailable: Dispatch<SetStateAction<boolean>>;
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
}

const TourSaveExploreContext = createRequiredContext<TourSaveExploreValue>(
  "TourSaveExploreContext",
);

export function TourSaveExploreProvider({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);

  const value: TourSaveExploreValue = {
    available,
    setAvailable,
    open,
    setOpen,
  };

  return (
    <TourSaveExploreContext.Provider value={value}>
      {children}
    </TourSaveExploreContext.Provider>
  );
}

export function useTourSaveExplore(): TourSaveExploreValue {
  return useRequiredContext(TourSaveExploreContext);
}
