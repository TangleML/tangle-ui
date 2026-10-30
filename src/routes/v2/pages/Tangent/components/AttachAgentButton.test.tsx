import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import type {
  DialogConfig,
  DialogProps,
} from "@/providers/DialogProvider/types";
import { useTangentBaseUrl } from "@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl";
import { copyToClipboard } from "@/utils/string";

import { AttachAgentButton } from "./AttachAgentButton";

vi.mock("@/providers/DialogProvider/hooks/useDialog", () => ({
  useDialog: vi.fn(),
}));

vi.mock("@/routes/v2/pages/Tangent/hooks/useTangentBaseUrl", () => ({
  useTangentBaseUrl: vi.fn(),
}));

vi.mock("@/utils/string", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/string")>()),
  copyToClipboard: vi.fn(),
}));

const BASE_URL = "http://tangent";
const SESSION_ID = "sess-1";

interface DialogComponentProps {
  baseUrl: string;
  sessionId: string;
}

function mockBaseUrl(baseUrl: string | null) {
  vi.mocked(useTangentBaseUrl).mockReturnValue({
    baseUrl,
    localAddress: null,
    isLoading: false,
    isError: false,
  });
}

function captureDialogOpen() {
  let config: DialogConfig<void, DialogComponentProps> | undefined;
  const open = vi.fn((opened: DialogConfig<void, DialogComponentProps>) => {
    config = opened;
    return Promise.resolve();
  });
  vi.mocked(useDialog).mockReturnValue({
    open: open as ReturnType<typeof useDialog>["open"],
    close: vi.fn(),
    cancel: vi.fn(),
    closeAll: vi.fn(),
    stack: [],
  });
  return { getConfig: () => config };
}

function renderDialog(config: DialogConfig<void, DialogComponentProps>) {
  const props: DialogProps<void, DialogComponentProps> = {
    close: vi.fn(),
    cancel: vi.fn(),
    ...(config.props ?? { baseUrl: BASE_URL, sessionId: SESSION_ID }),
  };
  return render(
    <Dialog open>
      <DialogContent>{createElement(config.component, props)}</DialogContent>
    </Dialog>,
  );
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("AttachAgentButton", () => {
  it("renders nothing until Tangent's location is known", () => {
    mockBaseUrl(null);
    captureDialogOpen();

    const { container } = render(
      <AttachAgentButton projectId="p1" sessionId={SESSION_ID} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("opens the attach dialog for the session when clicked", async () => {
    const user = userEvent.setup();
    mockBaseUrl(BASE_URL);
    const { getConfig } = captureDialogOpen();

    render(<AttachAgentButton projectId="p1" sessionId={SESSION_ID} />);
    await user.click(
      screen.getByRole("button", { name: "Attach a local agent" }),
    );

    const config = getConfig();
    if (!config) throw new Error("dialog was not opened");
    expect(config.routeKey).toBe("attach-agent");
    expect(config.props).toEqual({ baseUrl: BASE_URL, sessionId: SESSION_ID });
  });

  it("shows the attach command for the selected agent with the url and session filled in", async () => {
    const user = userEvent.setup();
    mockBaseUrl(BASE_URL);
    const { getConfig } = captureDialogOpen();

    render(<AttachAgentButton projectId="p1" sessionId={SESSION_ID} />);
    await user.click(
      screen.getByRole("button", { name: "Attach a local agent" }),
    );

    const config = getConfig();
    if (!config) throw new Error("dialog was not opened");
    renderDialog(config);

    expect(
      screen.getByText(`/tangent-acp-attach ${BASE_URL} ${SESSION_ID} claude`),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Codex" }));

    expect(
      screen.getByText(`$tangent-acp-attach ${BASE_URL} ${SESSION_ID} codex`),
    ).toBeInTheDocument();
  });

  it("copies the attach command of the selected agent", async () => {
    const user = userEvent.setup();
    mockBaseUrl(BASE_URL);
    const { getConfig } = captureDialogOpen();

    render(<AttachAgentButton projectId="p1" sessionId={SESSION_ID} />);
    await user.click(
      screen.getByRole("button", { name: "Attach a local agent" }),
    );

    const config = getConfig();
    if (!config) throw new Error("dialog was not opened");
    renderDialog(config);

    const copyButton = document.querySelector(
      '[data-tracking-id="projects.attach_agent.copy_command"]',
    );
    if (!copyButton) throw new Error("copy button was not rendered");

    await user.click(copyButton);

    expect(copyToClipboard).toHaveBeenCalledWith(
      `/tangent-acp-attach ${BASE_URL} ${SESSION_ID} claude`,
    );
  });
});
