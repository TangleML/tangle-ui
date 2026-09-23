import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AiModelSelect } from "./AiModelSelect";

const scrollIntoView = HTMLElement.prototype.scrollIntoView;

describe("AiModelSelect", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    delete window.__TANGLE_AI_MODELS__;
  });

  it("supports keyboard selection and restores focus after selection and Escape", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<AiModelSelect value="gpt-6-sol" onValueChange={onValueChange} />);
    const trigger = screen.getByRole("combobox", { name: "AI model" });

    expect(trigger).toHaveTextContent("GPT-6 Sol");
    expect(trigger).not.toHaveTextContent("For everyday work and coding.");

    await user.tab();
    expect(trigger).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("option", { name: "GPT-6 Sol" })).toHaveFocus();
    expect(screen.getByText("For everyday work and coding.")).toBeVisible();
    expect(
      screen.queryByRole("option", { name: "Provider default" }),
    ).not.toBeInTheDocument();

    await user.keyboard("{ArrowDown}");
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "GPT-6 Astra" })).toHaveFocus();
    });
    await user.keyboard("{Enter}");

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("gpt-6-astra");
    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveFocus();
    });

    await user.keyboard("{Enter}");
    expect(screen.getByRole("listbox")).toBeVisible();
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveFocus();
    });
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it("keeps a long saved model alongside injected choices with optional labels", () => {
    const customModel =
      "team/private-model-with-a-long-version-and-deployment-name";
    window.__TANGLE_AI_MODELS__ = {
      models: [
        {
          id: "proxy-frontier",
          label: "Our team's private frontier model",
          description: "Available through the team provider.",
        },
        { id: "proxy-fast" },
      ],
    };
    const onValueChange = vi.fn();
    render(
      <AiModelSelect
        value={customModel}
        onValueChange={onValueChange}
        ariaLabel="Select a model"
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Select a model" });
    expect(trigger).toHaveTextContent(customModel);
    fireEvent.click(trigger);

    expect(
      screen.getByRole("option", { name: customModel }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "proxy-fast" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "GPT-6 Sol" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Available through the team provider."),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole("option", {
        name: "Our team's private frontier model",
      }),
    );
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("proxy-frontier");
  });

  it("uses an empty model value when selecting the provider default", () => {
    const onValueChange = vi.fn();
    const { rerender } = render(
      <AiModelSelect
        value="gpt-6-sol"
        onValueChange={onValueChange}
        allowProviderDefault
      />,
    );

    fireEvent.click(screen.getByRole("combobox", { name: "AI model" }));
    fireEvent.click(screen.getByRole("option", { name: "Provider default" }));
    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("");

    rerender(
      <AiModelSelect
        value=""
        onValueChange={onValueChange}
        allowProviderDefault
      />,
    );
    expect(
      screen.getByRole("combobox", { name: "AI model" }),
    ).toHaveTextContent("Provider default");
  });
});
