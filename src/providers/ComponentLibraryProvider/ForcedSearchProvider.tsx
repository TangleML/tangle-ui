import {
  createContext,
  type PropsWithChildren,
  useContext,
  useReducer,
} from "react";

import { DEFAULT_FILTERS } from "@/utils/constants";

import type { LibraryFilterRequest } from "./types";

interface ForcedSearchContextType {
  currentSearchFilter: Required<LibraryFilterRequest>;
  highlightSearchResults: boolean;
}

type ForcedSearchAction =
  | { type: "updateSearchFilter"; payload: Partial<LibraryFilterRequest> }
  | { type: "highlightSearchFilter"; payload: Partial<LibraryFilterRequest> }
  | { type: "resetSearchFilter" };

// todo: make generic and re-use
type Payload<K extends ForcedSearchAction["type"]> =
  Extract<ForcedSearchAction, { type: K }> extends { payload: infer P }
    ? P
    : never;

const ForcedComponentSearchContext = createContext<
  ForcedSearchContextType & {
    updateSearchFilter: (payload: Payload<"updateSearchFilter">) => void;
    highlightSearchFilter: (payload: Payload<"highlightSearchFilter">) => void;
    resetSearchFilter: () => void;
  }
>({
  currentSearchFilter: {
    searchTerm: "",
    filters: DEFAULT_FILTERS,
  },
  highlightSearchResults: false,
  updateSearchFilter: () => {},
  highlightSearchFilter: () => {},
  resetSearchFilter: () => {},
});

const forcedSearchReducer = (
  state: ForcedSearchContextType,
  action: ForcedSearchAction,
) => {
  switch (action.type) {
    case "updateSearchFilter":
      return {
        ...state,
        currentSearchFilter: {
          ...state.currentSearchFilter,
          ...action.payload,
        },
      };
    case "highlightSearchFilter":
      return {
        ...state,
        highlightSearchResults: true,
        currentSearchFilter: {
          ...state.currentSearchFilter,
          ...action.payload,
        },
      };
    case "resetSearchFilter":
      return {
        currentSearchFilter: {
          searchTerm: "",
          filters: DEFAULT_FILTERS,
        },
        highlightSearchResults: false,
      };
  }
};

export const ForcedSearchProvider = ({ children }: PropsWithChildren) => {
  const [state, dispatch] = useReducer(forcedSearchReducer, {
    currentSearchFilter: {
      searchTerm: "",
      filters: DEFAULT_FILTERS,
    },
    highlightSearchResults: false,
  });

  const updateSearchFilter = (payload: Partial<LibraryFilterRequest>) => {
    dispatch({ type: "updateSearchFilter", payload });
  };

  const resetSearchFilter = () => {
    dispatch({ type: "resetSearchFilter" });
  };

  const highlightSearchFilter = (payload: Partial<LibraryFilterRequest>) => {
    dispatch({ type: "highlightSearchFilter", payload });
  };

  const value = {
    ...state,
    updateSearchFilter,
    resetSearchFilter,
    highlightSearchFilter,
  };

  return (
    <ForcedComponentSearchContext.Provider value={value}>
      {children}
    </ForcedComponentSearchContext.Provider>
  );
};

export const useForcedSearchContext = () => {
  return useContext(ForcedComponentSearchContext);
};
