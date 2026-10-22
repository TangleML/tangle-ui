import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Secret } from "@/components/shared/SecretsManagement/types";
import { Dialog, DialogContent } from "@/components/ui/dialog";

import {
  SecretFormDialog,
  type SecretFormDialogProps,
} from "./SecretFormDialog";

const { notify, track } = vi.hoisted(() => ({
  notify: vi.fn(),
  track: vi.fn(),
}));

vi.mock(
  "@/components/shared/SecretsManagement/components/AddSecretForm",
  () => ({
    AddSecretForm: ({
      teamId,
      onSuccess,
    }: {
      teamId?: string;
      onSuccess: () => void;
    }) => (
      <button data-team-id={teamId ?? ""} onClick={onSuccess}>
        Save
      </button>
    ),
  }),
);

vi.mock("@/hooks/useToastNotification", () => ({ default: () => notify }));
vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

const TEAM = { id: "ml-team@example.com", label: "ML Research" };

const apiKey: Secret = {
  id: "API_KEY",
  name: "API_KEY",
  createdAt: new Date("2026-10-01T09:00:00Z"),
  updatedAt: new Date("2026-10-02T09:00:00Z"),
};

function renderDialog(props: SecretFormDialogProps) {
  const close = vi.fn();
  render(
    <Dialog open>
      <DialogContent>
        <SecretFormDialog close={close} cancel={vi.fn()} {...props} />
      </DialogContent>
    </Dialog>,
  );
  return { user: userEvent.setup(), close };
}

describe("SecretFormDialog", () => {
  afterEach(() => vi.clearAllMocks());

  it("adds a team secret for everyone in the team", async () => {
    const { user, close } = renderDialog({ team: TEAM });

    expect(screen.getByRole("dialog", { name: "Add a secret" })).toBeVisible();
    expect(
      screen.getByText("Everyone in ML Research can use it in this project."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "data-team-id",
      TEAM.id,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(close).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith("Secret added", "success");
    expect(track).toHaveBeenCalledWith("projects.secrets.secret_mutated", {
      action: "created",
      owner: "team",
    });
  });

  it("adds a secret of your own without a team", () => {
    renderDialog({});

    expect(screen.getByText("Only runs you submit can use it.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute(
      "data-team-id",
      "",
    );
  });

  it("replaces a secret's value", async () => {
    const { user } = renderDialog({ secret: apiKey, team: TEAM });

    expect(
      screen.getByRole("dialog", { name: "Replace API_KEY" }),
    ).toBeVisible();
    expect(
      screen.getByText("Runs that start after this use the new value."),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(notify).toHaveBeenCalledWith('Secret "API_KEY" replaced', "success");
    expect(track).toHaveBeenCalledWith("projects.secrets.secret_mutated", {
      action: "updated",
      owner: "team",
    });
  });
});
