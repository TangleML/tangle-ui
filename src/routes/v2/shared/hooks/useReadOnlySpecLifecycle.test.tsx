import { render } from "@testing-library/react";
import {
  isRootStore,
  registerRootStore,
  unregisterRootStore,
} from "mobx-keystone";
import { StrictMode } from "react";
import { expect, it } from "vitest";

import { ComponentSpec } from "@/models/componentSpec";
import { SharedStoreProvider } from "@/routes/v2/shared/store/SharedStoreContext";

import { useReadOnlySpecLifecycle } from "./useReadOnlySpecLifecycle";

function ReadOnlyView({ spec }: { spec: ComponentSpec }) {
  useReadOnlySpecLifecycle(spec);
  return null;
}

it.each([false, true])(
  "only releases registrations it owns (external owner: %s)",
  (externallyOwned) => {
    const spec = new ComponentSpec({ name: "Pipeline" });
    if (externallyOwned) registerRootStore(spec);
    const view = render(
      <StrictMode>
        <SharedStoreProvider>
          <ReadOnlyView spec={spec} />
        </SharedStoreProvider>
      </StrictMode>,
    );
    expect(isRootStore(spec)).toBe(true);
    view.unmount();
    expect(isRootStore(spec)).toBe(externallyOwned);
    if (externallyOwned) unregisterRootStore(spec);
  },
);
