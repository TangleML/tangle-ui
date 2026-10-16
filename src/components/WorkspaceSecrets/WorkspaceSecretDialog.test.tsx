import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DialogProvider } from "@/providers/DialogProvider/DialogProvider";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import { DialogCancelledError } from "@/providers/DialogProvider/types";
import type { WorkspaceSecret } from "@/services/projects/types";
import {
  useCreateWorkspaceSecret,
  useReplaceWorkspaceSecret,
} from "@/services/projects/useWorkspaceSecrets";
import { toEndOfDayUTC } from "@/utils/date";

import {
  WorkspaceSecretDialog,
  type WorkspaceSecretDialogProps,
} from "./WorkspaceSecretDialog";

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

const track = vi.fn();
vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

const notify = vi.fn();
vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));

vi.mock("@/services/projects/useWorkspaceSecrets", () => ({
  useCreateWorkspaceSecret: vi.fn(),
  useReplaceWorkspaceSecret: vi.fn(),
}));

const create = vi.fn();
const replace = vi.fn();
const resolved = vi.fn();
const rejected = vi.fn();

const existing: WorkspaceSecret = {
  name: "API_KEY",
  description: "Model access",
  expiresAt: null,
  createdAt: new Date("2026-10-01T09:00:00Z"),
  updatedAt: new Date("2026-10-02T09:00:00Z"),
  createdBy: "alice@example.com",
  canManage: true,
};

function Opener({ props }: { props: WorkspaceSecretDialogProps }) {
  const { open } = useDialog();

  return (
    <button
      onClick={() =>
        void open<WorkspaceSecret, WorkspaceSecretDialogProps>({
          component: WorkspaceSecretDialog,
          props,
        }).then(resolved, rejected)
      }
    >
      Open
    </button>
  );
}

async function openDialog(secret?: WorkspaceSecret) {
  const user = userEvent.setup();
  render(
    <DialogProvider disableRouterSync>
      <Opener props={{ workspaceId: "ws-1", secret }} />
    </DialogProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Open" }));
  return user;
}

const field = (label: string | RegExp) => screen.getByLabelText(label);

function succeedWith(mutate: typeof create, saved: WorkspaceSecret) {
  mutate.mockImplementation(
    (_variables: unknown, options?: { onSuccess?: (s: unknown) => void }) =>
      options?.onSuccess?.(saved),
  );
}

describe("WorkspaceSecretDialog", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
    vi.mocked(useCreateWorkspaceSecret).mockReturnValue({
      mutate: create,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateWorkspaceSecret>);
    vi.mocked(useReplaceWorkspaceSecret).mockReturnValue({
      mutate: replace,
      isPending: false,
    } as unknown as ReturnType<typeof useReplaceWorkspaceSecret>);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("adding", () => {
    it("adds a secret with a trimmed name and its description", async () => {
      const user = await openDialog();

      await user.type(field("Name"), "  API_KEY  ");
      await user.type(field("Value"), "s3cret");
      await user.type(field("Description (optional)"), "Model access");
      await user.click(screen.getByRole("button", { name: "Add secret" }));

      expect(create).toHaveBeenCalledWith(
        {
          name: "API_KEY",
          value: "s3cret",
          description: "Model access",
          expiresAt: undefined,
        },
        expect.anything(),
      );
    });

    it("leaves out a description that was never written", async () => {
      const user = await openDialog();

      await user.type(field("Name"), "API_KEY");
      await user.type(field("Value"), "s3cret");
      await user.click(screen.getByRole("button", { name: "Add secret" }));

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ description: undefined }),
        expect.anything(),
      );
    });

    it("closes with the saved secret and says so", async () => {
      succeedWith(create, existing);
      const user = await openDialog();

      await user.type(field("Name"), "API_KEY");
      await user.type(field("Value"), "s3cret");
      await user.click(screen.getByRole("button", { name: "Add secret" }));

      await waitFor(() => expect(resolved).toHaveBeenCalledWith(existing));
      expect(notify).toHaveBeenCalledWith("Secret added", "success");
      expect(track).toHaveBeenCalledWith(
        "projects.workspace_secrets.secret_mutated",
        { action: "created" },
      );
    });

    it("stays open with what was typed when the save fails", async () => {
      const user = await openDialog();

      await user.type(field("Name"), "API_KEY");
      await user.type(field("Value"), "s3cret");
      await user.click(screen.getByRole("button", { name: "Add secret" }));

      expect(resolved).not.toHaveBeenCalled();
      expect(field("Name")).toHaveValue("API_KEY");
    });

    it("asks for a name and a value before saving", async () => {
      const user = await openDialog();

      await user.click(screen.getByRole("button", { name: "Add secret" }));

      expect(screen.getByText("Name cannot be empty")).toBeVisible();
      expect(screen.getByText("Value cannot be empty")).toBeVisible();
      expect(field("Name")).toHaveAttribute("aria-invalid", "true");
      expect(create).not.toHaveBeenCalled();
    });

    it("refuses a name with a slash in it", async () => {
      const user = await openDialog();

      await user.type(field("Name"), "team/API_KEY");
      await user.type(field("Value"), "s3cret");
      await user.click(screen.getByRole("button", { name: "Add secret" }));

      expect(screen.getByText("Name cannot contain /")).toBeVisible();
      expect(create).not.toHaveBeenCalled();
    });

    it("never shows the value it was given", async () => {
      const user = await openDialog();

      await user.type(field("Value"), "s3cret");

      expect(field("Value")).toHaveAttribute("type", "password");
      expect(screen.queryByText("s3cret")).toBeNull();
      expect(field("Value")).toHaveAccessibleDescription(
        "Stored securely. It can't be viewed after saving.",
      );
    });

    it("sends the expiry as the end of the chosen day in UTC", async () => {
      const now = new Date();
      const chosen = new Date(now.getFullYear(), now.getMonth() + 1, 15);
      const user = await openDialog();

      await user.type(field("Name"), "API_KEY");
      await user.type(field("Value"), "s3cret");
      await user.click(field("Expires (optional)"));
      await user.click(screen.getByRole("button", { name: /next month/i }));
      await user.click(screen.getByRole("button", { name: /15th/ }));
      await user.click(screen.getByRole("button", { name: "Add secret" }));

      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ expiresAt: toEndOfDayUTC(chosen) }),
        expect.anything(),
      );
    });

    it("cancels without saving", async () => {
      const user = await openDialog();

      await user.click(screen.getByRole("button", { name: "Cancel" }));

      await waitFor(() =>
        expect(rejected).toHaveBeenCalledWith(expect.any(DialogCancelledError)),
      );
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe("replacing", () => {
    it("names the secret it replaces and asks for no new name", async () => {
      await openDialog(existing);

      expect(
        screen.getByRole("heading", { name: "Replace API_KEY" }),
      ).toBeVisible();
      expect(screen.queryByLabelText("Name")).toBeNull();
      expect(field("Description (optional)")).toHaveValue("Model access");
    });

    it("sends only the new value when nothing else changed", async () => {
      const user = await openDialog(existing);

      await user.type(field("New value"), "n3w");
      await user.click(screen.getByRole("button", { name: "Replace" }));

      expect(replace).toHaveBeenCalledWith(
        {
          name: "API_KEY",
          input: { value: "n3w", description: undefined, expiresAt: undefined },
        },
        expect.anything(),
      );
    });

    it("sends a description that was changed", async () => {
      const user = await openDialog(existing);

      await user.type(field("New value"), "n3w");
      await user.clear(field("Description (optional)"));
      await user.type(field("Description (optional)"), "Agent model access");
      await user.click(screen.getByRole("button", { name: "Replace" }));

      expect(replace).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            description: "Agent model access",
          }),
        }),
        expect.anything(),
      );
    });

    it("still needs a new value", async () => {
      const user = await openDialog(existing);

      await user.click(screen.getByRole("button", { name: "Replace" }));

      expect(screen.getByText("Value cannot be empty")).toBeVisible();
      expect(replace).not.toHaveBeenCalled();
    });

    it("says what an empty expiry does", async () => {
      await openDialog(existing);

      expect(screen.getByText("No expiry")).toBeVisible();
      expect(field("Expires (optional)")).toHaveAccessibleDescription(
        "Leave empty to keep it unchanged.",
      );
    });

    it("closes with the saved secret and says so", async () => {
      succeedWith(replace, existing);
      const user = await openDialog(existing);

      await user.type(field("New value"), "n3w");
      await user.click(screen.getByRole("button", { name: "Replace" }));

      await waitFor(() => expect(resolved).toHaveBeenCalledWith(existing));
      expect(notify).toHaveBeenCalledWith("Secret replaced", "success");
      expect(track).toHaveBeenCalledWith(
        "projects.workspace_secrets.secret_mutated",
        { action: "replaced" },
      );
    });
  });
});
