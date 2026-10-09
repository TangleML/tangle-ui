import type { AnchorProtocolProps } from "@tangent/embed-react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { tangentAnchorProtocols } from "./tangentAnchorProtocols";

const openWorkareaTarget = vi.fn();
const notify = vi.fn();

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => ({ openWorkareaTarget }),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => notify,
}));

vi.mock("@/routes/runRoutes", () => ({
  getDefaultRunPath: (runId: string) => `/runs/${runId}`,
}));

const RunAnchor = tangentAnchorProtocols.run;

function anchorProps(
  overrides: Partial<AnchorProtocolProps> = {},
): AnchorProtocolProps {
  return {
    href: "run://id/run_1",
    protocol: "run",
    path: "id/run_1",
    label: "Training run",
    ...overrides,
  };
}

describe("tangentAnchorProtocols run anchor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("open", vi.fn());
  });

  it("opens the run in the workarea on a plain click", () => {
    render(<RunAnchor {...anchorProps()} />);
    fireEvent.click(screen.getByRole("button"));

    expect(openWorkareaTarget).toHaveBeenCalledWith(
      { type: "run", identity: "id/run_1" },
      "Training run",
    );
    expect(window.open).not.toHaveBeenCalled();
  });

  it("opens the run in the workarea on a shift-click", () => {
    render(<RunAnchor {...anchorProps()} />);
    fireEvent.click(screen.getByRole("button"), { shiftKey: true });

    expect(openWorkareaTarget).toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
  });

  it.each([
    ["ctrl", { ctrlKey: true }],
    ["meta", { metaKey: true }],
  ])("opens the run page in a new tab on a %s-click", (_modifier, event) => {
    render(<RunAnchor {...anchorProps()} />);
    fireEvent.click(screen.getByRole("button"), event);

    expect(window.open).toHaveBeenCalledWith("/runs/run_1", "_blank");
    expect(openWorkareaTarget).not.toHaveBeenCalled();
  });

  it("accepts a bare run id", () => {
    render(<RunAnchor {...anchorProps({ path: "run_2" })} />);
    fireEvent.click(screen.getByRole("button"), { metaKey: true });

    expect(window.open).toHaveBeenCalledWith("/runs/run_2", "_blank");
  });

  it("disables the chip when the path is not a run", () => {
    render(<RunAnchor {...anchorProps({ path: "name/nope" })} />);

    expect(screen.getByRole("button")).toBeDisabled();
  });
});
