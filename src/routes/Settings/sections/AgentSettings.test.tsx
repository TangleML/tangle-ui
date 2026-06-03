import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentSettings } from "./AgentSettings";

const STORAGE_KEY = "tangle.componentSearchV2.config";
const mockNotify = vi.fn();
const mockFetch = vi.fn();

vi.mock("@/hooks/useToastNotification", () => ({
  default: () => mockNotify,
}));

describe("AgentSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockNotify.mockClear();
    mockFetch.mockReset();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("shows inline feedback instead of saving when API base URL is blank", () => {
    render(<AgentSettings />);

    fireEvent.change(screen.getByLabelText("API base URL"), {
      target: { value: "   " },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter an API base URL before continuing.",
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(mockNotify).not.toHaveBeenCalledWith(
      "AI provider settings saved",
      "success",
    );
  });

  it("saves with only an API base URL", () => {
    render(<AgentSettings />);

    fireEvent.change(screen.getByLabelText("API base URL"), {
      target: { value: "https://proxy.example.com/v1" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}"),
    ).toEqual({
      apiBase: "https://proxy.example.com/v1",
      apiKey: "",
      model: "",
    });
    expect(mockNotify).toHaveBeenCalledWith(
      "AI provider settings saved",
      "success",
    );
  });

  it("tests a proxy connection without an API key or model", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 }),
    );
    render(<AgentSettings />);

    fireEvent.change(screen.getByLabelText("API base URL"), {
      target: { value: "https://proxy.example.com/v1" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "https://proxy.example.com/v1/models",
        {
          headers: undefined,
        },
      );
      expect(mockNotify).toHaveBeenCalledWith(
        "Connected to AI provider.",
        "success",
      );
    });
  });

  it("validates that the configured model exists when testing connection", async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ data: [{ id: "gpt-4o-mini" }, { id: "o3-mini" }] }),
        { status: 200 },
      ),
    );
    render(<AgentSettings />);

    fireEvent.change(screen.getByLabelText("API base URL"), {
      target: { value: "https://api.example.com/v1" },
    });
    fireEvent.change(screen.getByLabelText("API key"), {
      target: { value: "sk-test" },
    });
    fireEvent.change(screen.getByLabelText("Model id"), {
      target: { value: "gpt-4o-mini" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        "Connected. Model “gpt-4o-mini” is available.",
        "success",
      );
    });
  });

  it("reports an error when the configured model is missing from provider models", async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "gpt-4o-mini" }] }), {
        status: 200,
      }),
    );
    render(<AgentSettings />);

    fireEvent.change(screen.getByLabelText("API base URL"), {
      target: { value: "https://api.example.com/v1" },
    });
    fireEvent.change(screen.getByLabelText("API key"), {
      target: { value: "sk-test" },
    });
    fireEvent.change(screen.getByLabelText("Model id"), {
      target: { value: "missing-model" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        "Connected, but model “missing-model” was not found.",
        "error",
      );
    });
  });

  it("allows clearing partially configured settings", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        apiBase: "https://api.example.com/v1",
        apiKey: "sk-test",
      }),
    );

    render(<AgentSettings />);

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(mockNotify).toHaveBeenCalledWith(
      "AI provider settings cleared",
      "success",
    );
  });
});
