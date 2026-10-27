import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import IOInputs from "./IOInputs";

vi.mock("./IOCell/IOCell", () => ({
  default: ({
    name,
    secretName,
  }: {
    name: string;
    secretName?: string | null;
  }) => <div data-testid={`io-cell-${name}`} data-secret={secretName ?? ""} />,
}));

describe("IOInputs", () => {
  it("passes each input the secret it was given", () => {
    render(
      <IOInputs
        inputs={[{ name: "api_token" }, { name: "rows" }, { name: "source" }]}
        artifacts={{ input_artifacts: {} }}
        taskArguments={{
          api_token: { dynamicData: { secret: { name: "Test" } } },
          rows: "100",
        }}
      />,
    );

    expect(screen.getByTestId("io-cell-api_token")).toHaveAttribute(
      "data-secret",
      "Test",
    );
    expect(screen.getByTestId("io-cell-rows")).toHaveAttribute(
      "data-secret",
      "",
    );
    expect(screen.getByTestId("io-cell-source")).toHaveAttribute(
      "data-secret",
      "",
    );
  });
});
