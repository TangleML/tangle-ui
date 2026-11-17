import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchArtifactFile } from "@/routes/v2/pages/Tangent/services/artifactText";
import { downloadBlobAsFile } from "@/utils/URL";
import { getUserDetails } from "@/utils/user";

import { TextArtifactView } from "./TextArtifactView";

vi.mock("@/components/shared/CodeViewer/CodeEditor", () => ({
  default: ({
    value,
    language,
    readOnly,
  }: {
    value: string;
    language: string;
    readOnly?: boolean;
  }) => (
    <pre
      data-testid="code-editor"
      data-language={language}
      data-readonly={String(readOnly)}
    >
      {value}
    </pre>
  ),
}));

vi.mock("@/utils/user", () => ({
  getUserDetails: vi.fn(),
}));

vi.mock("@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken", () => ({
  remoteEnvAuthToken: (userId: string | undefined) =>
    userId ? `jwt-for-${userId}` : undefined,
}));

vi.mock("@/routes/v2/pages/Tangent/services/artifactText", async (actual) => ({
  ...(await actual<
    typeof import("@/routes/v2/pages/Tangent/services/artifactText")
  >()),
  fetchArtifactFile: vi.fn(),
}));

vi.mock("@/utils/URL", () => ({ downloadBlobAsFile: vi.fn() }));

const FILE_URL =
  "https://tangent.example/api/sessions/s1/files/artifacts/q.sql";

const SQL_FILE = { blob: new Blob(["select 1;"]), text: "select 1;" };

function givenUser() {
  vi.mocked(getUserDetails).mockResolvedValue({
    id: "me@example.com",
    permissions: [],
  });
}

function renderView() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TextArtifactView url={FILE_URL} title="Daily query" />
    </QueryClientProvider>,
  );
}

describe("TextArtifactView", () => {
  afterEach(() => vi.resetAllMocks());

  it("shows the file read-only, highlighted by its extension", async () => {
    givenUser();
    vi.mocked(fetchArtifactFile).mockResolvedValue(SQL_FILE);

    renderView();

    const editor = await screen.findByTestId("code-editor");
    expect(editor).toHaveTextContent("select 1;");
    expect(editor).toHaveAttribute("data-language", "sql");
    expect(editor).toHaveAttribute("data-readonly", "true");
    expect(fetchArtifactFile).toHaveBeenCalledWith(
      FILE_URL,
      "jwt-for-me@example.com",
    );
  });

  it("downloads the raw file under its name", async () => {
    givenUser();
    vi.mocked(fetchArtifactFile).mockResolvedValue(SQL_FILE);

    renderView();
    await screen.findByTestId("code-editor");
    await userEvent.click(screen.getByRole("button", { name: "Download" }));

    expect(downloadBlobAsFile).toHaveBeenCalledWith(SQL_FILE.blob, "q.sql");
  });

  it("waits for the user before loading the file", () => {
    vi.mocked(getUserDetails).mockReturnValue(new Promise(() => {}));

    renderView();

    expect(screen.getByTestId("spinner")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toBeDisabled();
    expect(fetchArtifactFile).not.toHaveBeenCalled();
  });

  it("shows the load error and keeps Download disabled", async () => {
    givenUser();
    vi.mocked(fetchArtifactFile).mockRejectedValue(
      new Error("Failed to load this file (404 Not Found)."),
    );

    renderView();

    expect(
      await screen.findByText("Failed to load this file (404 Not Found)."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toBeDisabled();
  });
});
