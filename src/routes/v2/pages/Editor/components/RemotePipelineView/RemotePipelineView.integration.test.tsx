import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import {
  IncrementingIdGenerator,
  serializeComponentSpecToText,
  YamlDeserializer,
} from "@/models/componentSpec";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { FLEX_NODES_ANNOTATION } from "@/utils/annotationKeys";

import { RemotePipelineView } from "./RemotePipelineView";

vi.mock("@/routes/router", async () => import("@/routes/appRoutes"));
vi.mock("@/routes/v2/shared/components/AppMenuActions", () => ({
  AppMenuActions: () => null,
}));
vi.mock("@/providers/ComponentLibraryProvider", () => ({
  ComponentLibraryProvider: ({ children }: PropsWithChildren) => children,
}));

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("mounts real task, input, output, and note nodes without an editor session", async () => {
  const spec = new YamlDeserializer(new IncrementingIdGenerator()).deserialize({
    name: "Remote pipeline",
    inputs: [{ name: "Source", type: "String" }],
    outputs: [{ name: "Result", type: "String" }],
    implementation: {
      graph: {
        tasks: {
          Process: {
            componentRef: {
              spec: {
                name: "Processor",
                implementation: { container: { image: "example/processor" } },
              },
            },
          },
        },
      },
    },
  });
  spec.annotations.set(FLEX_NODES_ANNOTATION, [
    {
      id: "flex_note",
      properties: {
        title: "Review note",
        content: "Check the pipeline output.",
        color: "#FFF9C4",
      },
      metadata: { createdAt: "2026-01-01T00:00:00Z", createdBy: "example" },
      size: { width: 200, height: 120 },
      position: { x: 0, y: 300 },
      zIndex: 0,
    },
  ]);
  const initialYaml = serializeComponentSpecToText(spec);
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory(),
  });
  const { container } = render(
    <RouterContextProvider router={router}>
      <ThemeProvider>
        <RemotePipelineView spec={spec} />
      </ThemeProvider>
    </RouterContextProvider>,
  );

  await waitFor(() => {
    expect(container.querySelectorAll(".react-flow__node")).toHaveLength(4);
  });
  expect(screen.getByText("Process")).toBeInTheDocument();
  expect(screen.getByText("Source")).toBeInTheDocument();
  expect(screen.getByText("Result")).toBeInTheDocument();
  const note = container.querySelector(".react-flow__node-flex");
  expect(note).toBeInstanceOf(HTMLElement);
  if (!(note instanceof HTMLElement)) throw new Error("Note did not mount");
  expect(
    within(note).getByText("Check the pipeline output."),
  ).toBeInTheDocument();
  expect(within(note).queryByRole("button")).not.toBeInTheDocument();

  fireEvent.doubleClick(within(note).getByText("Review note"));
  fireEvent.doubleClick(within(note).getByText("Check the pipeline output."));
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(container.querySelector(".react-flow__resize-control")).toBeNull();
  expect(serializeComponentSpecToText(spec)).toBe(initialYaml);
});
