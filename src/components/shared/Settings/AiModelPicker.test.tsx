import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAiModelOptions } from "@/config/aiConfig";
import {
  AI_PROVIDER_STORAGE_KEY,
  AI_PROXY_STORAGE_KEY,
  AI_USE_OWN_KEY_STORAGE_KEY,
} from "@/hooks/useAiProviderSettings";

import { AiModelPicker } from "./AiModelPicker";

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "https://backend.example.com" }),
}));

const customModel = { id: "custom-model", label: "Custom model" };
const customCatalog = { models: [customModel] };
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
const saveModelPreferences = (config: unknown) =>
  window.localStorage.setItem(AI_PROXY_STORAGE_KEY, JSON.stringify(config));

function renderPicker(variant: "settings" | "compact" | "header" = "settings") {
  const result = render(<AiModelPicker variant={variant} />);
  openPicker();
  return result;
}

function selectModel(name: string) {
  openModels();
  fireEvent.click(modelOption(name));
}

function openCustomModel() {
  openModels();
  fireEvent.click(button("Custom model…"));
  return screen.getByRole("textbox", { name: "Model ID" });
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
      saveModelPreferences({
        model: "gpt-6-sol",
      });
    }
    renderPicker();
    const selectedModel = configured ? "GPT-6 Sol" : "GPT-6 Astra";
    expectEffort("High");
    expect(modelTitle()).toHaveTextContent(selectedModel);
    expect(modelTitle()).toHaveAccessibleName(
      `Choose a model: ${selectedModel}`,
    );
    fireEvent.pointerDown(modelTitle());
    openModels();
    expect(button("Models: back to model settings")).toHaveTextContent(
      "Models",
    );
    expect(
      screen.getByRole("radiogroup", { name: "Models" }),
    ).toBeInTheDocument();
    screen.getByRole("dialog", { name: "Model and thinking" });
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: "Provider default" }),
    ).toBeNull();
    const sol = modelOption("GPT-6 Sol");
    expect(modelOption(selectedModel)).toBeChecked();
    expect(sol).toHaveAccessibleDescription(
      "Balanced model for coding and agentic workflows",
    );
    expect(modelOption(selectedModel)).toHaveFocus();
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

  it.each(["settings", "compact", "header"] as const)(
    "selects a custom model without thinking in %s",
    async (variant) => {
      const { unmount } = renderPicker(variant);
      const input = openCustomModel();
      expect(input).toHaveFocus();
      expect(button("Use model")).toBeDisabled();
      fireEvent.change(input, { target: { value: "   " } });
      fireEvent.keyDown(input, { key: "Enter" });
      expect(button("Use model")).toBeDisabled();
      expect(window.localStorage.getItem(AI_PROXY_STORAGE_KEY)).toBeNull();
      fireEvent.change(input, { target: { value: "  vendor/custom-model  " } });
      fireEvent.keyDown(input, { key: "Enter" });
      expectClosed();
      expect(trigger()).toHaveTextContent("vendor/custom-model");
      expect(trigger()).toHaveAccessibleName(
        "AI model and thinking: vendor/custom-model",
      );
      await waitFor(() => expect(trigger()).toHaveFocus());
      const saved = window.localStorage.getItem(AI_PROXY_STORAGE_KEY);
      expect(JSON.parse(saved ?? "").model).toBe("vendor/custom-model");
      expect(canvasShortcut).not.toHaveBeenCalled();
      expect(fetch).not.toHaveBeenCalled();
      unmount();

      renderPicker(variant);
      expect(modelTitle()).toHaveTextContent("vendor/custom-model");
      expect(screen.queryByRole("slider")).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Thinking:|Unavailable/),
      ).not.toBeInTheDocument();
      openModels();
      expect(modelOption("vendor/custom-model")).toBeChecked();
      expect(modelOption("vendor/custom-model")).toHaveFocus();
      fireEvent.click(button("Custom model…"));
      expect(screen.getByRole("textbox", { name: "Model ID" })).toHaveValue(
        "vendor/custom-model",
      );
    },
  );

  it("stages custom model selections when a callback is provided", () => {
    const onCustomModelSelect = vi.fn();
    const onModelSelect = vi.fn();
    const { rerender } = render(
      <AiModelPicker
        onCustomModelSelect={onCustomModelSelect}
        onModelSelect={onModelSelect}
      />,
    );
    openPicker();
    const input = openCustomModel();
    fireEvent.change(input, { target: { value: " custom-draft " } });
    fireEvent.click(button("Use model"));
    expectClosed();
    expect(onCustomModelSelect).toHaveBeenCalledWith("custom-draft");
    expect(onModelSelect).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(AI_PROXY_STORAGE_KEY)).toBeNull();

    rerender(
      <AiModelPicker
        modelDraft="custom-draft"
        onCustomModelSelect={onCustomModelSelect}
        onModelSelect={onModelSelect}
      />,
    );
    expect(trigger()).toHaveTextContent("custom-draft");
    openPicker();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    openModels();
    fireEvent.keyDown(modelOption("custom-draft"), { key: "Home" });
    expect(onCustomModelSelect).toHaveBeenCalledTimes(2);
    expect(onModelSelect).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(AI_PROXY_STORAGE_KEY)).toBeNull();
    escape();
    selectModel("custom-draft");
    expect(onCustomModelSelect).toHaveBeenCalledTimes(3);
    expect(onCustomModelSelect).toHaveBeenLastCalledWith("custom-draft");
    expect(onModelSelect).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(AI_PROXY_STORAGE_KEY)).toBeNull();
    selectModel("GPT-6 Sol");
    expect(onModelSelect).toHaveBeenCalledOnce();
    const saved = window.localStorage.getItem(AI_PROXY_STORAGE_KEY);
    expect(JSON.parse(saved ?? "").model).toBe("gpt-6-sol");
  });

  it.each([false, true])(
    "discards open custom edits when switching provider mode from own key %s",
    (ownKey) => {
      window.localStorage.setItem(
        AI_USE_OWN_KEY_STORAGE_KEY,
        JSON.stringify(ownKey),
      );
      renderPicker();
      const input = openCustomModel();
      fireEvent.change(input, { target: { value: "unfinished-model" } });

      act(() => {
        window.localStorage.setItem(
          AI_USE_OWN_KEY_STORAGE_KEY,
          JSON.stringify(!ownKey),
        );
        window.dispatchEvent(
          new StorageEvent("storage", { key: AI_USE_OWN_KEY_STORAGE_KEY }),
        );
      });

      expectClosed();
      expect(window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY)).toBeNull();
      expect(window.localStorage.getItem(AI_PROXY_STORAGE_KEY)).toBeNull();
      openPicker();
      expect(openCustomModel()).toHaveValue("");
      expect(button("Use model")).toBeDisabled();
    },
  );

  it("cancels custom edits with back and Escape while containing shortcuts", async () => {
    renderPicker();
    let input = openCustomModel();
    fireEvent.change(input, { target: { value: "unsaved-model" } });
    fireEvent.keyDown(input, { key: "a", metaKey: true });
    fireEvent.keyDown(input, { key: "Delete" });
    fireEvent.click(button("Custom model: back to models"));
    expect(button("Custom model…")).toHaveFocus();
    fireEvent.click(button("Custom model…"));
    input = screen.getByRole("textbox", { name: "Model ID" });
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    escape();
    expect(button("Custom model…")).toHaveFocus();
    escape();
    expect(thinking()).toBeInTheDocument();
    escape();
    expectClosed();
    expect(window.localStorage.getItem(AI_PROXY_STORAGE_KEY)).toBeNull();
    expect(canvasShortcut).not.toHaveBeenCalled();
    await waitFor(() => expect(trigger()).toHaveFocus());
  });

  it.each(variants)(
    "navigates the model radio group with the keyboard in %s",
    async (variant) => {
      const user = userEvent.setup();
      renderPicker(variant);
      openModels();
      expect(modelOption("GPT-6 Astra")).toHaveFocus();
      for (const [key, label] of [
        ["ArrowDown", "GPT-6 Sol"],
        ["ArrowDown", "GPT-6 Luna"],
        ["ArrowDown", "Claude Fable 5.1"],
        ["ArrowUp", "GPT-6 Luna"],
        ["ArrowLeft", "GPT-6 Sol"],
        ["ArrowRight", "GPT-6 Luna"],
        ["Home", "GPT-6 Astra"],
        ["End", "Claude Haiku 5.5"],
        ["ArrowDown", "GPT-6 Astra"],
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
      expect(
        screen.queryByText(/Thinking:|Unavailable/),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("slider")).not.toBeInTheDocument();
      unmount();
      window.__TANGLE_AI_MODELS__ = {
        models: [...models, customModel],
      };
    }
    renderPicker(variant);
    selectModel("GPT-6 Sol");
    fireEvent.keyDown(thinking(), { key: "Home" });
    selectModel("GPT-6 Astra");
    expectEffort("Low");
    expectText(/Your none preference is saved/);
    const saved = window.localStorage.getItem(AI_PROXY_STORAGE_KEY);
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
    saveModelPreferences({
      model: "gpt-6-sol",
      reasoningEffortPreference: "none",
    });
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

  it.each(["thinking", "models", "custom"])(
    "dismisses %s outside",
    async (view) => {
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
      if (view === "custom") openCustomModel();
      fireEvent.pointerDown(screen.getByTestId("canvas"));
      expectClosed();
      expect(interactWithCanvas).toHaveBeenCalledOnce();
      openPicker();
      expect(thinking()).toBeInTheDocument();
      const input = screen.getByRole("textbox", { name: "Component search" });
      await user.click(input);
      expectClosed();
      expect(input).toHaveFocus();
    },
  );
});
