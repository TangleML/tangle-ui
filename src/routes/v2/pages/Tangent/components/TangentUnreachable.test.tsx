import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TangentUnreachable } from "./TangentUnreachable";

describe("TangentUnreachable", () => {
  it("names the address that did not answer, so it can be checked", () => {
    render(<TangentUnreachable baseUrl="http://localhost:5173" />);

    expect(screen.getByTestId("info-box-title")).toHaveTextContent(
      "Tangent isn't reachable",
    );
    expect(
      screen.getByText(/Nothing answered at http:\/\/localhost:5173/),
    ).toBeInTheDocument();
  });

  it("offers a way out rather than leaving the page blank", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <TangentUnreachable baseUrl="http://localhost:5173" onRetry={onRetry} />,
    );

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(onRetry).toHaveBeenCalled();
  });
});
