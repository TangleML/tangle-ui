import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAiModelOptions } from "@/config/aiModels";
import { AI_PROVIDER_STORAGE_KEY } from "@/hooks/useAiProviderSettings";
import { useAvailableAiModels } from "@/hooks/useAvailableAiModels";

import { AiModelPicker } from "./AiModelPicker";

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => ({ backendUrl: "https://backend.example.com" }),
}));

vi.mock("@/hooks/useAvailableAiModels", () => ({
  useAvailableAiModels: vi.fn(),
}));

function openPicker() {
  fireEvent.click(
    screen.getByRole("button", { name: /^AI model and thinking:/ }),
  );
}

function selectModel(name: string) {
  fireEvent.click(screen.getByRole("button", { name: "Choose a model" }));
  fireEvent.click(screen.getByRole("button", { name }));
}

describe("AiModelPicker", () => {
  beforeEach(() => {
    vi.mocked(useAvailableAiModels).mockImplementation(() => ({
      options: getAiModelOptions(),
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }));
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
    vi.unstubAllGlobals();
    window.localStorage.clear();
    delete window.__TANGLE_AI_MODELS__;
  });

  it("opens on Sol with High thinking and returns to thinking after choosing a model", () => {
    render(<AiModelPicker />);
    openPicker();

    expect(screen.getByRole("slider", { name: "Thinking" })).toHaveAttribute(
      "aria-valuetext",
      "High",
    );
    expect(
      screen.getByRole("button", { name: "Choose a model" }),
    ).toHaveTextContent("GPT-6 Sol");
    fireEvent.click(screen.getByRole("button", { name: "Choose a model" }));
    const dialog = screen.getByRole("dialog", { name: "Model and thinking" });
    expect(within(dialog).queryByRole("slider")).not.toBeInTheDocument();
    expect(
      within(dialog).queryByText("Provider default"),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "GPT-6 Sol" }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(within(dialog).getByRole("button", { name: "GPT-6 Luna" }));

    expect(
      screen.getByRole("button", { name: "Choose a model" }),
    ).toHaveTextContent("GPT-6 Luna");
    expect(screen.getByRole("slider", { name: "Thinking" })).toHaveAttribute(
      "aria-valuetext",
      "High",
    );
    expect(
      screen.getByRole("button", { name: "Choose a model" }),
    ).toHaveFocus();
  });

  it("persists a keyboard-selected effort across model changes and remounts", () => {
    const { unmount } = render(<AiModelPicker />);
    openPicker();
    fireEvent.keyDown(screen.getByRole("slider", { name: "Thinking" }), {
      key: "ArrowRight",
    });
    expect(screen.getByRole("slider", { name: "Thinking" })).toHaveAttribute(
      "aria-valuetext",
      "Extra high",
    );
    selectModel("GPT-6 Astra");
    expect(screen.getByRole("slider", { name: "Thinking" })).toHaveAttribute(
      "aria-valuetext",
      "Extra high",
    );
    unmount();

    render(<AiModelPicker />);
    openPicker();
    expect(
      screen.getByRole("button", { name: "Choose a model" }),
    ).toHaveTextContent("GPT-6 Astra");
    expect(screen.getByRole("slider", { name: "Thinking" })).toHaveAttribute(
      "aria-valuetext",
      "Extra high",
    );
  });

  it("shows the nearest supported effort without overwriting the preference", () => {
    render(<AiModelPicker />);
    openPicker();
    fireEvent.keyDown(screen.getByRole("slider", { name: "Thinking" }), {
      key: "Home",
    });
    selectModel("GPT-6 Astra");

    expect(screen.getByRole("slider", { name: "Thinking" })).toHaveAttribute(
      "aria-valuetext",
      "Low",
    );
    expect(
      screen.getByText(/Your none preference is saved/),
    ).toBeInTheDocument();
    expect(
      JSON.parse(window.localStorage.getItem(AI_PROVIDER_STORAGE_KEY) ?? "")
        .reasoningEffort,
    ).toBe("none");

    selectModel("GPT-6 Sol");
    expect(screen.getByRole("slider", { name: "Thinking" })).toHaveAttribute(
      "aria-valuetext",
      "None",
    );
  });

  it("uses Escape to go back from models, then close and restore trigger focus", async () => {
    render(<AiModelPicker />);
    openPicker();
    fireEvent.click(screen.getByRole("button", { name: "Choose a model" }));
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    expect(
      screen.getByRole("slider", { name: "Thinking" }),
    ).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /^AI model and thinking:/ }),
      ).toHaveFocus(),
    );
  });

  it("keeps picker keyboard actions from reaching canvas shortcuts", () => {
    const canvasShortcut = vi.fn();
    window.addEventListener("keydown", canvasShortcut);
    try {
      render(<AiModelPicker variant="compact" />);
      openPicker();
      const slider = screen.getByRole("slider", { name: "Thinking" });
      fireEvent.keyDown(slider, { key: "ArrowRight" });
      expect(slider).toHaveAttribute("aria-valuetext", "Extra high");
      fireEvent.keyDown(slider, { key: "Delete" });
      fireEvent.keyDown(slider, { key: "a", metaKey: true });
      fireEvent.click(screen.getByRole("button", { name: "Choose a model" }));
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: "Escape",
      });
      expect(
        screen.getByRole("slider", { name: "Thinking" }),
      ).toBeInTheDocument();
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: "Escape",
      });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(canvasShortcut).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", canvasShortcut);
    }
  });

  it.each(["thinking", "models"])(
    "closes the %s view on the first outside press even when the canvas stops propagation",
    (view) => {
      const interactWithCanvas = vi.fn();
      render(
        <>
          <AiModelPicker />
          <div
            data-testid="canvas"
            onPointerDown={(event) => {
              event.stopPropagation();
              interactWithCanvas();
            }}
          />
        </>,
      );
      openPicker();
      if (view === "models") {
        fireEvent.click(screen.getByRole("button", { name: "Choose a model" }));
      }

      fireEvent.pointerDown(screen.getByTestId("canvas"));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(interactWithCanvas).toHaveBeenCalledOnce();
      openPicker();
      expect(
        screen.getByRole("slider", { name: "Thinking" }),
      ).toBeInTheDocument();
    },
  );

  it("keeps focus on an outside control after dismissing", async () => {
    const user = userEvent.setup();
    render(
      <>
        <AiModelPicker />
        <input aria-label="Component search" />
      </>,
    );
    await user.click(
      screen.getByRole("button", { name: /^AI model and thinking:/ }),
    );
    const input = screen.getByRole("textbox", { name: "Component search" });

    await user.click(input);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it("keeps inside presses open and lets the trigger close without reopening", () => {
    render(<AiModelPicker />);
    openPicker();
    const title = screen.getByRole("button", { name: "Choose a model" });

    fireEvent.pointerDown(title);
    fireEvent.click(title);
    expect(
      screen.getByRole("button", { name: "Back to thinking" }),
    ).toBeInTheDocument();

    const trigger = screen.getByRole("button", {
      name: /^AI model and thinking:/,
    });
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the header, settings, and assistant selections synchronized", () => {
    render(
      <>
        <AiModelPicker variant="header" />
        <AiModelPicker />
        <AiModelPicker variant="compact" />
      </>,
    );
    fireEvent.click(
      screen.getAllByRole("button", { name: /^AI model and thinking:/ })[2],
    );
    fireEvent.keyDown(screen.getByRole("slider", { name: "Thinking" }), {
      key: "End",
    });
    selectModel("GPT-6 Luna");
    expect(
      screen.getAllByRole("button", {
        name: "AI model and thinking: GPT-6 Luna, Max",
      }),
    ).toHaveLength(3);
  });

  it("preserves custom models without sending an unsupported thinking setting", () => {
    window.__TANGLE_AI_MODELS__ = {
      defaultModel: "custom-model",
      models: [{ id: "custom-model", label: "Custom model" }],
    };
    render(<AiModelPicker />);
    openPicker();
    expect(
      screen.getByText("Thinking controls aren’t available for this model."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("preserves thinking through models with different effort support", () => {
    window.__TANGLE_AI_MODELS__ = {
      models: [
        ...getAiModelOptions(),
        { id: "custom-model", label: "Custom model" },
      ],
    };
    render(<AiModelPicker variant="compact" />);
    openPicker();
    fireEvent.keyDown(screen.getByRole("slider", { name: "Thinking" }), {
      key: "Home",
    });
    selectModel("GPT-6 Astra");
    expect(screen.getByRole("slider", { name: "Thinking" })).toHaveAttribute(
      "aria-valuetext",
      "Low",
    );
    selectModel("Custom model");
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    selectModel("GPT-6 Sol");
    expect(screen.getByRole("slider", { name: "Thinking" })).toHaveAttribute(
      "aria-valuetext",
      "None",
    );
  });

  it("shows only compatible options, even if the saved model is unavailable", () => {
    vi.mocked(useAvailableAiModels).mockReturnValue({
      options: [{ id: "gpt-6-astra", label: "GPT-6 Astra" }],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<AiModelPicker />);
    openPicker();
    expect(screen.getByRole("status")).toHaveTextContent(
      "This model isn’t available with the current provider.",
    );
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Choose another model" }),
    );
    expect(
      screen.getByRole("button", { name: "GPT-6 Astra" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "GPT-6 Sol" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "GPT-6 Luna" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "GPT-6 Astra" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Thinking" })).toHaveAttribute(
      "aria-valuetext",
      "High",
    );
  });
});
