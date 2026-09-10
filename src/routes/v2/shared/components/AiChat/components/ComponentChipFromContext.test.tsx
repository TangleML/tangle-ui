import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ComponentRefData } from "@/routes/v2/shared/components/AiChat/types";
import { hydrateComponentReference } from "@/services/componentService";

import {
  ComponentChipFromContext,
  ComponentRefsContext,
} from "./ComponentChipFromContext";

vi.mock("@/services/componentService", () => ({
  hydrateComponentReference: vi.fn(),
}));

vi.mock("./ComponentChip", () => ({
  ComponentChip: ({
    componentRef,
    label,
  }: {
    componentRef: ComponentRefData;
    label: string;
  }) => (
    <div
      data-testid="component-chip"
      data-name={componentRef.name}
      data-yaml={componentRef.yamlText}
    >
      {label}
    </div>
  ),
}));

function renderInContext(
  ui: ReactNode,
  refs?: Record<string, ComponentRefData>,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ComponentRefsContext.Provider value={refs}>
        {ui}
      </ComponentRefsContext.Provider>
    </QueryClientProvider>,
  );
}

describe("ComponentChipFromContext", () => {
  beforeEach(() => {
    vi.mocked(hydrateComponentReference).mockReset();
  });

  it("uses ComponentRefsContext when the id is present, without hydrating", () => {
    renderInContext(
      <ComponentChipFromContext componentId="digest-1" label="From Context" />,
      { "digest-1": { name: "Ctx Component", yamlText: "ctx: yaml" } },
    );

    const chip = screen.getByTestId("component-chip");
    expect(chip).toHaveTextContent("From Context");
    expect(chip).toHaveAttribute("data-name", "Ctx Component");
    expect(chip).toHaveAttribute("data-yaml", "ctx: yaml");
    expect(hydrateComponentReference).not.toHaveBeenCalled();
  });

  it("hydrates by digest when the context has no matching id", async () => {
    vi.mocked(hydrateComponentReference).mockResolvedValue({
      digest: "digest-2",
      name: "Hydrated Component",
      text: "hydrated: yaml",
      spec: {
        name: "Hydrated Component",
        implementation: { container: { image: "img:latest" } },
      },
    });

    renderInContext(
      <ComponentChipFromContext componentId="digest-2" label="Hydrating" />,
    );

    // Fallback inline label renders until the query resolves.
    expect(screen.queryByTestId("component-chip")).toBeNull();
    expect(screen.getByText("Hydrating")).toBeInTheDocument();

    const chip = await screen.findByTestId("component-chip");
    expect(chip).toHaveAttribute("data-name", "Hydrated Component");
    expect(chip).toHaveAttribute("data-yaml", "hydrated: yaml");
    expect(hydrateComponentReference).toHaveBeenCalledWith({
      digest: "digest-2",
    });
  });

  it("keeps the inline label fallback when hydration resolves nothing", async () => {
    vi.mocked(hydrateComponentReference).mockResolvedValue(null);

    renderInContext(
      <ComponentChipFromContext componentId="digest-3" label="Unresolved" />,
    );

    await waitFor(() =>
      expect(hydrateComponentReference).toHaveBeenCalledWith({
        digest: "digest-3",
      }),
    );
    expect(screen.queryByTestId("component-chip")).toBeNull();
    expect(screen.getByText("Unresolved")).toBeInTheDocument();
  });
});
