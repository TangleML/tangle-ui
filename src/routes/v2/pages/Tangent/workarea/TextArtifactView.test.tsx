import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchArtifactText } from "@/routes/v2/pages/Tangent/services/artifactText";
import { downloadStringAsFile } from "@/utils/URL";

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

vi.mock("@/routes/v2/pages/Tangent/hooks/useRemoteEnvAuthToken", () => ({
  useRemoteEnvAuthToken: () => "jwt",
}));

vi.mock("@/routes/v2/pages/Tangent/services/artifactText", async (actual) => ({
  ...(await actual<
    typeof import("@/routes/v2/pages/Tangent/services/artifactText")
  >()),
  fetchArtifactText: vi.fn(),
}));

vi.mock("@/utils/URL", () => ({ downloadStringAsFile: vi.fn() }));

const FILE_URL =
  "https://tangent.example/api/sessions/s1/files/artifacts/q.sql";

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
    vi.mocked(fetchArtifactText).mockResolvedValue("select 1;");

    renderView();

    const editor = await screen.findByTestId("code-editor");
    expect(editor).toHaveTextContent("select 1;");
    expect(editor).toHaveAttribute("data-language", "sql");
    expect(editor).toHaveAttribute("data-readonly", "true");
    expect(fetchArtifactText).toHaveBeenCalledWith(FILE_URL, "jwt");
  });

  it("downloads the loaded text under the file's name", async () => {
    vi.mocked(fetchArtifactText).mockResolvedValue("select 1;");

    renderView();
    await screen.findByTestId("code-editor");
    await userEvent.click(screen.getByRole("button", { name: "Download" }));

    expect(downloadStringAsFile).toHaveBeenCalledWith(
      "select 1;",
      "q.sql",
      "text/plain",
    );
  });

  it("shows the load error and keeps Download disabled", async () => {
    vi.mocked(fetchArtifactText).mockRejectedValue(
      new Error("Failed to load this file (404 Not Found)."),
    );

    renderView();

    expect(
      await screen.findByText("Failed to load this file (404 Not Found)."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download" })).toBeDisabled();
  });
});
