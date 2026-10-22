import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import type { PropsWithChildren } from "react";
import { afterEach, expect, it, vi } from "vitest";

import {
  IncrementingIdGenerator,
  serializeComponentSpecToText,
  YamlDeserializer,
} from "@/models/componentSpec";
import { SpecProvider } from "@/routes/v2/shared/providers/SpecContext";
import { SharedStoreProvider } from "@/routes/v2/shared/store/SharedStoreContext";
import { AggregatorOutputType } from "@/types/aggregator";

import { RunViewTaskNode } from "./RunViewTaskNode";

vi.mock("@/components/shared/Settings/useFlags", async (original) => ({
  ...(await original<typeof import("@/components/shared/Settings/useFlags")>()),
  useFlagValue: (flag: string) =>
    flag === "input-aggregator" || flag === "remote-component-library-search",
}));
vi.mock("@/providers/ExecutionDataProvider", () => ({
  useExecutionDataOptional: () => null,
}));
vi.mock("@/providers/ThemeProvider", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));
vi.mock("@/components/shared/ManageComponent/PublishedComponentBadge", () => ({
  PublishedComponentBadge: ({
    children,
    readOnly,
  }: PropsWithChildren<{ readOnly?: boolean }>) => (
    <div data-testid="published-component-badge" data-read-only={readOnly}>
      {children}
    </div>
  ),
}));

afterEach(cleanup);

it("keeps run aggregators and their published component badges read-only", () => {
  const spec = new YamlDeserializer(new IncrementingIdGenerator()).deserialize({
    name: "Run pipeline",
    implementation: {
      graph: {
        tasks: {
          "Aggregate inputs": {
            arguments: { output_type: AggregatorOutputType.JsonArray },
            componentRef: {
              digest: "9c9388aa60fe27b6",
              spec: {
                name: "Aggregator",
                metadata: {
                  annotations: { is_input_aggregator: "true" },
                },
                implementation: {
                  container: { image: "example.com/aggregate" },
                },
              },
            },
          },
        },
      },
    },
  });
  const task = spec.tasks[0];
  const initialYaml = serializeComponentSpecToText(spec);

  render(
    <SharedStoreProvider>
      <SpecProvider spec={spec}>
        <ReactFlowProvider>
          <RunViewTaskNode
            id={task.$id}
            type="task"
            data={{ entityId: task.$id, name: task.name }}
            selected={false}
            dragging={false}
            draggable={false}
            selectable
            deletable={false}
            isConnectable={false}
            zIndex={0}
            positionAbsoluteX={0}
            positionAbsoluteY={0}
          />
        </ReactFlowProvider>
      </SpecProvider>
    </SharedStoreProvider>,
  );

  const selector = screen.getByRole("combobox");
  expect(selector).toBeDisabled();
  fireEvent.click(selector);
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(screen.getByTestId("published-component-badge")).toHaveAttribute(
    "data-read-only",
    "true",
  );
  expect(serializeComponentSpecToText(spec)).toBe(initialYaml);
});
