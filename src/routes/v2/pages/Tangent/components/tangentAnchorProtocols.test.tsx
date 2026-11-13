import type { AnchorProtocolProps } from "@tangent/embed-react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { tangentAnchorProtocols } from "./tangentAnchorProtocols";

const openWorkareaTarget = vi.fn();
const notify = vi.fn();

vi.mock("@/routes/v2/pages/Tangent/context/TangentProjectContext", () => ({
  useTangentProject: () => ({
    openWorkareaTarget,
    activeSessionId: "session-1",
  }),
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

  it("opens the run in the workarea on a plain click, adding it to this chat's runs", () => {
    render(<RunAnchor {...anchorProps()} />);
    fireEvent.click(screen.getByRole("button"));

    expect(openWorkareaTarget).toHaveBeenCalledWith(
      { type: "run", identity: "id/run_1" },
      "Training run",
      { recordRunIn: "session-1" },
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

describe("tangentAnchorProtocols pipeline and document anchors", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens a referenced pipeline in the workarea", () => {
    const PipelineAnchor = tangentAnchorProtocols.pipeline;
    render(
      <PipelineAnchor
        {...anchorProps({
          href: "pipeline://id/p-1",
          protocol: "pipeline",
          path: "id/p-1",
          label: "Churn model",
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button"));

    expect(openWorkareaTarget).toHaveBeenCalledWith(
      { type: "pipeline", identity: "id/p-1" },
      "Churn model",
      { recordRunIn: "session-1" },
    );
  });

  it("opens a referenced document in the workarea", () => {
    const DocumentAnchor = tangentAnchorProtocols.document;
    render(
      <DocumentAnchor
        {...anchorProps({
          href: "document://id/d-1",
          protocol: "document",
          path: "id/d-1",
          label: "Brief",
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button"));

    expect(openWorkareaTarget).toHaveBeenCalledWith(
      { type: "document", identity: "id/d-1" },
      "Brief",
      { recordRunIn: "session-1" },
    );
  });

  it("can't open a link that isn't a workarea target", () => {
    const PipelineAnchor = tangentAnchorProtocols.pipeline;
    render(
      <PipelineAnchor
        {...anchorProps({
          href: "pipeline://nowhere",
          protocol: "pipeline",
          path: "nowhere",
          label: "Lost",
        })}
      />,
    );

    expect(screen.getByRole("button")).toBeDisabled();
  });
});
