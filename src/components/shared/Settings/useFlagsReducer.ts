import { useEffect, useReducer } from "react";

import type { ConfigFlags, Flag } from "@/types/configuration";

import { useFlags } from "./useFlags";

interface SetFlagAction {
  type: "setFlag";
  payload: {
    key: string;
    enabled: boolean;
  };
}

type Action = SetFlagAction;
type State = Flag[];

export function useFlagsReducer(flags: ConfigFlags) {
  const { getFlag, setFlag, getFlags, removeFlag } = useFlags();

  useEffect(() => {
    // clean up unexisting flags
    const existingFlags = new Set(Object.keys(flags));

    Object.keys(getFlags() ?? {})
      .filter((flag) => !existingFlags.has(flag))
      .forEach((flag) => removeFlag(flag));
  }, [flags, getFlags, removeFlag]);

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
    Object.entries(flags).map(([key, flag]) => ({
      ...flag,
      key,
      enabled: getFlag(key, flag.default),
    })) satisfies State,
  );
}
