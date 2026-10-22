import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type RunIdentity,
  runIdentity,
} from "@/components/shared/SecretsManagement/runIdentity";
import { useRunIdentity } from "@/components/shared/SecretsManagement/useRunIdentity";
import type { TeamResolution } from "@/services/teams/types";
import type { ComponentSpec } from "@/utils/componentSpec";

import { SubmitTaskArgumentsDialog } from "./SubmitTaskArgumentsDialog";

vi.mock(
  "@/components/shared/SecretsManagement/useRunIdentity",
  async (importOriginal) => ({
    ...(await importOriginal()),
    useRunIdentity: vi.fn(),
  }),
);

vi.mock("@/hooks/useToastNotification", () => ({ default: () => vi.fn() }));

vi.mock("@/providers/TourProvider/TourModeContext", () => ({
  useTourMode: () => false,
}));

vi.mock("@/providers/TourProvider/tourMockBackend", () => ({
  useTourMockBackend: () => false,
}));

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "https://backend.test" }),
}));

const TEAM = { id: "search@example.com", label: "Search" };
const ACTIVE: TeamResolution = {
  status: "active",
  team: { ...TEAM, canWrite: true },
};

const spec: ComponentSpec = {
  name: "churn-training",
  inputs: [{ name: "greeting", type: "String", default: "hello" }],
  implementation: { graph: { tasks: {} } },
};

const named = (...names: string[]) => names.map((name) => ({ name }));

function renderDialog(
  identity: RunIdentity,
  { isChecking = false, team = ACTIVE } = {},
) {
  vi.mocked(useRunIdentity).mockReturnValue({ ...identity, isChecking });
  const onConfirm = vi.fn();
  render(
    <SubmitTaskArgumentsDialog
      open
      onCancel={vi.fn()}
      onConfirm={onConfirm}
      componentSpec={spec}
      team={team}
    />,
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={new QueryClient()}>
          {children}
        </QueryClientProvider>
      ),
    },
  );
  return { onConfirm, user: userEvent.setup() };
}

const submitButton = () => screen.getByRole("button", { name: "Submit Run" });

describe("SubmitTaskArgumentsDialog", () => {
  afterEach(() => vi.clearAllMocks());

  it("submits as you by default", async () => {
    const { onConfirm, user } = renderDialog(
      runIdentity({ team: TEAM, referenced: [] }),
    );

    await user.click(submitButton());

    expect(onConfirm).toHaveBeenCalledWith(
      { greeting: "hello" },
      "",
      undefined,
    );
  });

  it("checks the dialog's own arguments for secrets, along with the pipeline", () => {
    renderDialog(runIdentity({ team: TEAM, referenced: [] }));

    expect(useRunIdentity).toHaveBeenCalledWith(ACTIVE, [
      spec,
      { greeting: "hello" },
    ]);
  });

  it("submits as you, without offering the team, when you're not in it", async () => {
    const { onConfirm, user } = renderDialog(
      runIdentity({ team: undefined, referenced: [] }),
      { team: { status: "not-member", team: TEAM } },
    );

    expect(screen.getByTestId("info-box-title")).toHaveTextContent(
      "You're not in the Search workspace",
    );
    expect(screen.queryByRole("radio")).toBeNull();
    await user.click(submitButton());

    expect(onConfirm).toHaveBeenCalledWith(
      { greeting: "hello" },
      "",
      undefined,
    );
  });

  it("submits as the team when it's chosen", async () => {
    const { onConfirm, user } = renderDialog(
      runIdentity({ team: TEAM, referenced: [] }),
    );

    await user.click(screen.getByRole("radio", { name: "Workspace: Search" }));
    await user.click(submitButton());

    expect(onConfirm).toHaveBeenCalledWith({ greeting: "hello" }, "", TEAM.id);
  });

  it("submits as the team when only the team has a secret", async () => {
    const { onConfirm, user } = renderDialog(
      runIdentity({
        team: TEAM,
        referenced: ["Test"],
        yourSecrets: [],
        teamSecrets: named("Test"),
      }),
    );

    expect(screen.getByRole("radio", { name: "You" })).toBeDisabled();
    await user.click(submitButton());

    expect(onConfirm).toHaveBeenCalledWith({ greeting: "hello" }, "", TEAM.id);
  });

  it("waits for the secrets check", () => {
    renderDialog(runIdentity({ team: TEAM, referenced: [] }), {
      isChecking: true,
    });

    expect(submitButton()).toBeDisabled();
  });

  it.each<TeamResolution>([
    { status: "resolving" },
    {
      status: "conflict",
      teams: [TEAM, { id: "data@example.com", label: "Data" }],
    },
  ])("won't submit until the project's team is settled ($status)", (team) => {
    renderDialog(runIdentity({ team: undefined, referenced: [] }), { team });

    expect(submitButton()).toBeDisabled();
  });
});
