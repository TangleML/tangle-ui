import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AppMenuActions } from "@/routes/v2/shared/components/AppMenuActions";

import { ProjectHeader } from "./ProjectHeader";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...rest }: { children: ReactNode }) => (
    <a {...rest}>{children}</a>
  ),
}));

vi.mock("@/routes/v2/shared/components/AppMenuActions", () => ({
  AppMenuActions: vi.fn(() => <div data-testid="app-menu-actions" />),
}));

describe("Tangent ProjectHeader", () => {
  /** It is the app bar on this page, so it carries the app's own actions too. */
  it("keeps the app's own actions", () => {
    render(<ProjectHeader />);

    expect(screen.getByTestId("app-menu-actions")).toBeInTheDocument();
  });

  it("names Tangle beside its mark", () => {
    render(<ProjectHeader />);

    expect(screen.getByAltText("logo")).toHaveAttribute(
      "src",
      expect.stringContaining("Tangle_white"),
    );
  });

  it("leaves choosing a model to each chat's own picker", () => {
    render(<ProjectHeader />);

    expect(vi.mocked(AppMenuActions).mock.calls.at(-1)?.[0]).toEqual({
      showAiModelQuickSelect: false,
    });
  });

  /** The sidebar and the Project panel name the project now. */
  it("does not repeat the project's name", () => {
    render(<ProjectHeader />);

    expect(screen.queryByRole("heading")).toBeNull();
  });
});
