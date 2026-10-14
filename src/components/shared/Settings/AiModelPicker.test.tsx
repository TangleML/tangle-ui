import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAiModelOptions } from "@/config/aiConfig";
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
const modelOption = (name: string) => screen.getByRole("radio", { name });
const triggers = (name: string | RegExp = /^AI model and thinking:/) =>
  screen.getAllByRole("button", { name });
const trigger = () => button(/^AI model and thinking:/);
const modelTitle = () => button(/^Choose a model:/);
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
  fireEvent.click(modelOption(name));
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
    expect(modelTitle()).toHaveAccessibleName("Choose a model: GPT-6 Sol");
    fireEvent.pointerDown(modelTitle());
    openModels();
    expect(button("Models: back to thinking")).toHaveTextContent("Models");
    expect(
      screen.getByRole("radiogroup", { name: "Models" }),
    ).toBeInTheDocument();
    screen.getByRole("dialog", { name: "Model and thinking" });
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(modelOption("Provider default")).toBeInTheDocument();
    const sol = modelOption("GPT-6 Sol");
    expect(sol).toBeChecked();
    expect(sol).toHaveAccessibleDescription(
      "Balanced model for coding and agentic workflows",
    );
    expect(sol).toHaveFocus();
    expect(modelOption("GPT-6 Astra")).toBeInTheDocument();
    expect(modelOption("GPT-6 Luna")).toBeInTheDocument();
    const nextModel = configured ? "GPT-6 Astra" : "GPT-6 Luna";
    fireEvent.click(modelOption(nextModel));
    expect(modelTitle()).toHaveTextContent(nextModel);
    expectEffort("High");
    expect(modelTitle()).toHaveFocus();
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.pointerDown(trigger());
    fireEvent.click(trigger());
    expectClosed();
  });

  it("selects and persists the provider default", () => {
    const { unmount } = renderPicker();
    selectModel("Provider default");
    expect(modelTitle()).toHaveTextContent("Provider default");
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    const saved = window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY);
    expect(JSON.parse(saved ?? "").model).toBe("");
    unmount();

    renderPicker();
    expect(modelTitle()).toHaveTextContent("Provider default");
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    openModels();
    expect(modelOption("Provider default")).toBeChecked();
    expect(modelOption("Provider default")).toHaveFocus();
  });

  it.each(variants)(
    "navigates the model radio group with the keyboard in %s",
    async (variant) => {
      const user = userEvent.setup();
      renderPicker(variant);
      openModels();
      expect(modelOption("GPT-6 Sol")).toHaveFocus();
      for (const [key, label] of [
        ["ArrowDown", "GPT-6 Luna"],
        ["ArrowDown", "Claude Fable 5.1"],
        ["ArrowUp", "GPT-6 Luna"],
        ["ArrowLeft", "GPT-6 Sol"],
        ["ArrowRight", "GPT-6 Luna"],
        ["Home", "Provider default"],
        ["End", "Claude Haiku 5.5"],
        ["ArrowDown", "Provider default"],
        ["ArrowUp", "Claude Haiku 5.5"],
      ]) {
        await user.keyboard(`{${key}}`);
        expect(modelOption(label)).toHaveFocus();
        expect(modelOption(label)).toBeChecked();
        expect(modelOption(label)).toHaveAttribute("tabindex", "0");
        expect(screen.getAllByRole("radio", { checked: true })).toHaveLength(1);
        for (const option of screen.getAllByRole("radio", { checked: false })) {
          expect(option).toHaveAttribute("tabindex", "-1");
        }
      }
      await user.keyboard("{Enter}");
      expect(modelTitle()).toHaveTextContent("Claude Haiku 5.5");
      expect(modelTitle()).toHaveFocus();
      expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
      expect(canvasShortcut).not.toHaveBeenCalled();
    },
  );

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
    expect(JSON.parse(saved ?? "").reasoningEffortPreference).toBe("none");
    if (variant === "compact") {
      selectModel("Custom model");
      expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    }
    selectModel("GPT-6 Sol");
    expectEffort("None");
  });

  it.each([
    "Claude Fable 5.1",
    "Claude Opus 5.5",
    "Claude Sonnet 5.5",
    "Claude Haiku 5.5",
  ])("selects and persists thinking for %s", (model) => {
    saveProvider({ model: "gpt-6-sol", reasoningEffort: "none" });
    const { unmount } = renderPicker();
    selectModel(model);
    expectEffort("Low");
    expect(thinking()).toHaveAttribute("aria-valuemin", "0");
    expect(thinking()).toHaveAttribute("aria-valuemax", "4");
    expectText(/Your none preference is saved/);
    selectModel("GPT-6 Sol");
    expectEffort("None");
    selectModel(model);
    fireEvent.keyDown(thinking(), { key: "End" });
    expectEffort("Max");
    unmount();

    renderPicker();
    expect(modelTitle()).toHaveTextContent(model);
    expectEffort("Max");
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
