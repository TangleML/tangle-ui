import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAiModelOptions } from "@/config/aiModels";
import { AI_PROVIDER_STORAGE_KEY } from "@/hooks/useAiProviderSettings";

import { AiModelPicker } from "./AiModelPicker";

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "https://backend.example.com" }),
}));

const customModel = { id: "custom-model", label: "Custom model" };
const customCatalog = { defaultModel: customModel.id, models: [customModel] };
const variants = ["settings", "compact"] as const;
const canvasShortcut = vi.fn();
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const triggers = (name: string | RegExp = /^AI model and thinking:/) =>
  screen.getAllByRole("button", { name });
const trigger = () => button(/^AI model and thinking:/);
const modelTitle = () => button("Choose a model");
const thinking = () => screen.getByRole("slider", { name: "Thinking" });
const openPicker = () => fireEvent.click(trigger());
const openModels = () => fireEvent.click(modelTitle());
const expectEffort = (label: string) =>
  expect(thinking()).toHaveAttribute("aria-valuetext", label);
const expectText = (value: string | RegExp) =>
  expect(screen.getByText(value)).toBeInTheDocument();
const escape = () =>
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
const expectClosed = () => expect(screen.queryByRole("dialog")).toBeNull();
const saveProvider = (config: unknown) =>
  window.localStorage.setItem(AI_PROVIDER_STORAGE_KEY, JSON.stringify(config));

function renderPicker(variant: "settings" | "compact" = "settings") {
  const result = render(<AiModelPicker variant={variant} />);
  openPicker();
  return result;
}

function selectModel(name: string) {
  openModels();
  fireEvent.click(button(name));
}

describe("AiModelPicker", () => {
  beforeEach(() => {
    canvasShortcut.mockClear();
    window.addEventListener("keydown", canvasShortcut);
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    window.localStorage.clear();
    delete window.__TANGLE_AI_MODELS__;
  });
  afterEach(() => {
    window.removeEventListener("keydown", canvasShortcut);
    vi.unstubAllGlobals();
    window.localStorage.clear();
    delete window.__TANGLE_AI_MODELS__;
  });

  it.each([false, true])("selects models (configured: %s)", (configured) => {
    if (configured) {
      saveProvider({
        apiBase: "https://api.example.com/v1",
        apiKey: "sk-test",
        model: "gpt-6-sol",
      });
    }
    renderPicker();
    expectEffort("High");
    expect(modelTitle()).toHaveTextContent("GPT-6 Sol");
    fireEvent.pointerDown(modelTitle());
    openModels();
    expect(button("Back to thinking")).toBeInTheDocument();
    screen.getByRole("dialog", { name: "Model and thinking" });
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.queryByText("Provider default")).not.toBeInTheDocument();
    const sol = button("GPT-6 Sol");
    expect(sol).toHaveAttribute("aria-pressed", "true");
    expect(sol).toHaveFocus();
    expect(button("GPT-6 Astra")).toBeInTheDocument();
    expect(button("GPT-6 Luna")).toBeInTheDocument();
    const nextModel = configured ? "GPT-6 Astra" : "GPT-6 Luna";
    fireEvent.click(button(nextModel));
    expect(modelTitle()).toHaveTextContent(nextModel);
    expectEffort("High");
    expect(modelTitle()).toHaveFocus();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.pointerDown(trigger());
    fireEvent.click(trigger());
    expectClosed();
  });

  it("persists effort across model changes and remounts, and synchronizes all picker variants", () => {
    const { unmount } = renderPicker();
    fireEvent.keyDown(thinking(), { key: "ArrowRight" });
    expectEffort("Extra high");
    selectModel("GPT-6 Astra");
    expectEffort("Extra high");
    unmount();
    renderPicker();
    expect(modelTitle()).toHaveTextContent("GPT-6 Astra");
    expectEffort("Extra high");
    fireEvent.click(trigger());
    render(<AiModelPicker variant="header" />);
    render(<AiModelPicker variant="compact" />);
    fireEvent.click(triggers()[2]);
    fireEvent.keyDown(thinking(), { key: "End" });
    selectModel("GPT-6 Luna");
    expect(triggers("AI model and thinking: GPT-6 Luna, Max")).toHaveLength(3);
  });

  it.each(variants)("preserves effort preferences in %s", (variant) => {
    if (variant === "compact") {
      const models = getAiModelOptions();
      window.__TANGLE_AI_MODELS__ = customCatalog;
      const { unmount } = renderPicker();
      expectText("Thinking controls aren’t available for this model.");
      expect(screen.queryByRole("slider")).not.toBeInTheDocument();
      unmount();
      window.__TANGLE_AI_MODELS__ = {
        models: [...models, customModel],
      };
    }
    renderPicker(variant);
    fireEvent.keyDown(thinking(), { key: "Home" });
    selectModel("GPT-6 Astra");
    expectEffort("Low");
    expectText(/Your none preference is saved/);
    const saved = window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY);
    expect(JSON.parse(saved ?? "").reasoningEffort).toBe("none");
    if (variant === "compact") {
      selectModel("Custom model");
      expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    }
    selectModel("GPT-6 Sol");
    expectEffort("None");
  });

  it.each(variants)("isolates shortcuts and Escape in %s", async (variant) => {
    renderPicker(variant);
    fireEvent.keyDown(thinking(), { key: "ArrowRight" });
    expectEffort("Extra high");
    fireEvent.keyDown(thinking(), { key: "Delete" });
    fireEvent.keyDown(thinking(), { key: "a", metaKey: true });
    openModels();
    escape();
    expect(thinking()).toBeInTheDocument();
    escape();
    expectClosed();
    expect(canvasShortcut).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it.each(["thinking", "models"])("dismisses %s outside", async (view) => {
    const user = userEvent.setup();
    const interactWithCanvas = vi.fn();
    render(
      <>
        <AiModelPicker />
        <input aria-label="Component search" />
        <div
          data-testid="canvas"
          onPointerDown={(event) => {
            event.stopPropagation();
            interactWithCanvas();
          }}
        />
      </>,
    );
    await user.click(trigger());
    if (view === "models") openModels();
    fireEvent.pointerDown(screen.getByTestId("canvas"));
    expectClosed();
    expect(interactWithCanvas).toHaveBeenCalledOnce();
    openPicker();
    expect(thinking()).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: "Component search" });
    await user.click(input);
    expectClosed();
    expect(input).toHaveFocus();
  });
});
