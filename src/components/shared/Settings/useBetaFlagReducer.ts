import { useEffect, useReducer } from "react";

import type { BetaFlag, BetaFlags } from "@/types/betaFlags";

import { useBetaFlags } from "./useBetaFlags";

interface SetFlagAction {
  type: "setFlag";
  payload: {
    key: string;
    enabled: boolean;
  };
}

type Action = SetFlagAction;
type State = (BetaFlag & { key: string; enabled: boolean })[];

export function useBetaFlagsReducer(betaFlags: BetaFlags) {
  const { getFlag, setFlag, getFlags, removeFlag } = useBetaFlags();

  useEffect(() => {
    // clean up unexisting flags
    const existingFlags = new Set(Object.keys(betaFlags));

    Object.keys(getFlags() ?? {})
      .filter((flag) => !existingFlags.has(flag))
      .forEach((flag) => removeFlag(flag));
  }, [betaFlags, getFlags, removeFlag]);

  const reducer = (state: State, action: Action) => {
    switch (action.type) {
      case "setFlag":
        setFlag(action.payload.key, action.payload.enabled);

        return state.map((flag) =>
          flag.key === action.payload.key
            ? { ...flag, enabled: action.payload.enabled }
            : flag,
        );
      default:
        return state;
    }
  };

  return useReducer(
    reducer,
    Object.entries(betaFlags).map(([key, flag]) => ({
      ...flag,
      key,
      enabled: getFlag(key, flag.default),
    })) satisfies State,
  );
}
