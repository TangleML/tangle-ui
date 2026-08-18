import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrototypeBannerSettings } from "./PrototypeBannerSettings";

const SETTING_NAME = "system:web_ui/banners";

const fetchWithErrorHandling = vi.hoisted(() =>
  vi.fn<(url: string, options?: RequestInit) => Promise<unknown>>(() =>
    Promise.resolve({}),
  ),
);
const mockNotify = vi.hoisted(() => vi.fn());

vi.mock("@/utils/fetchWithErrorHandling", () => ({
  fetchWithErrorHandling: (url: string, options?: RequestInit) =>
    fetchWithErrorHandling(url, options),
}));

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => mockNotify,
}));

let backend = { available: true, backendUrl: "https://backend.example" };

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => backend,
}));

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PrototypeBannerSettings />
    </QueryClientProvider>,
  );
}

function typeDraft(text: string) {
  fireEvent.change(screen.getByTestId("prototype-banner-input"), {
    target: { value: text },
  });
}

function patchCalls() {
  return fetchWithErrorHandling.mock.calls.filter(
    ([, options]) => options?.method === "PATCH",
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchWithErrorHandling.mockResolvedValue({});
  backend = { available: true, backendUrl: "https://backend.example" };
});

describe("PrototypeBannerSettings", () => {
  it("shows the newest banner as the latest and the rest as history", async () => {
    fetchWithErrorHandling.mockResolvedValue({
      [SETTING_NAME]: [
        { "2026-01-01T00:00:00.000Z": "older banner" },
        { "2026-03-01T00:00:00.000Z": "newest banner" },
      ],
    });

    renderPanel();

    await waitFor(() =>
      expect(screen.getByTestId("prototype-banner-latest")).toHaveTextContent(
        "newest banner",
      ),
    );
    expect(screen.getByTestId("prototype-banner-latest")).not.toHaveTextContent(
      "older banner",
    );

    const history = screen.getByTestId("prototype-banner-history");
    expect(history).toHaveTextContent("newest banner");
    expect(history).toHaveTextContent("older banner");
    expect(screen.getByText("History (2)")).toBeInTheDocument();
  });

  it("saves a trimmed banner, clears the draft and confirms", async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.getByTestId("prototype-banner-latest")).toHaveTextContent(
        "No banners yet.",
      ),
    );

    typeDraft("  runs are delayed  ");
    fireEvent.click(screen.getByTestId("prototype-banner-save"));

    await waitFor(() => expect(patchCalls()).toHaveLength(1));
    const saved = JSON.parse(patchCalls()[0][1]?.body as string).settings[
      SETTING_NAME
    ];
    expect(Object.values(saved[0])).toEqual(["runs are delayed"]);

    await waitFor(() =>
      expect(screen.getByTestId("prototype-banner-input")).toHaveValue(""),
    );
    expect(mockNotify).toHaveBeenCalledWith("Banner saved", "success");
    // The saved banner is the new latest without a reload.
    expect(screen.getByTestId("prototype-banner-latest")).toHaveTextContent(
      "runs are delayed",
    );
  });

  it("does not save a whitespace-only draft", async () => {
    renderPanel();
    await waitFor(() =>
      expect(screen.getByTestId("prototype-banner-save")).toBeDisabled(),
    );

    typeDraft("   ");

    expect(screen.getByTestId("prototype-banner-save")).toBeDisabled();
    expect(patchCalls()).toHaveLength(0);
  });

  it("reports a failed save instead of clearing the draft", async () => {
    fetchWithErrorHandling.mockImplementation((_url, options) =>
      options?.method === "PATCH"
        ? Promise.reject(new Error("backend said no"))
        : Promise.resolve({}),
    );

    renderPanel();
    typeDraft("will fail");
    fireEvent.click(screen.getByTestId("prototype-banner-save"));

    await waitFor(() =>
      expect(mockNotify).toHaveBeenCalledWith(
        "Failed to save banner: backend said no",
        "error",
      ),
    );
    expect(screen.getByTestId("prototype-banner-input")).toHaveValue(
      "will fail",
    );
  });

  it("re-reads the banners when refreshed", async () => {
    fetchWithErrorHandling.mockResolvedValueOnce({
      [SETTING_NAME]: [{ "2026-03-01T00:00:00.000Z": "first read" }],
    });
    fetchWithErrorHandling.mockResolvedValueOnce({
      [SETTING_NAME]: [{ "2026-04-01T00:00:00.000Z": "second read" }],
    });

    renderPanel();
    await waitFor(() =>
      expect(screen.getByTestId("prototype-banner-latest")).toHaveTextContent(
        "first read",
      ),
    );

    fireEvent.click(screen.getByTestId("prototype-banner-refresh"));

    await waitFor(() =>
      expect(screen.getByTestId("prototype-banner-latest")).toHaveTextContent(
        "second read",
      ),
    );
  });

  it("renders every banner when two share a timestamp", async () => {
    const sameTs = "2026-03-01T00:00:00.000Z";
    fetchWithErrorHandling.mockResolvedValue({
      [SETTING_NAME]: [{ [sameTs]: "banner A" }, { [sameTs]: "banner B" }],
    });

    renderPanel();

    await waitFor(() =>
      expect(screen.getByText("History (2)")).toBeInTheDocument(),
    );
    const history = screen.getByTestId("prototype-banner-history");
    expect(history).toHaveTextContent("banner A");
    expect(history).toHaveTextContent("banner B");
  });

  it("asks for a backend instead of reading settings when none is connected", () => {
    backend = { available: false, backendUrl: "" };

    renderPanel();

    expect(
      screen.getByText("Connect a backend to read and write banners."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("prototype-banner-input")).toBeNull();
    expect(fetchWithErrorHandling).not.toHaveBeenCalled();
  });
});
