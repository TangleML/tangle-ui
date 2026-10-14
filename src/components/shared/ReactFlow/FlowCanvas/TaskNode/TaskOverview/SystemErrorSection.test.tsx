import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { SystemErrorSection } from "./SystemErrorSection";

const withMessage = (message: string) => `Traceback (most recent call last):
  File "/app/launchers/davies.py", line 361, in _raise_if_account_missing
    raise launcher_interfaces.LauncherError(
backend.cloud_pipelines_backend.launchers.interfaces.LauncherError: ${message}
`;

describe("SystemErrorSection", () => {
  test("shows the final exception message", () => {
    render(
      <SystemErrorSection
        systemErrorExceptionFull={withMessage("No active account.")}
      />,
    );

    expect(screen.getByText("System error")).toBeInTheDocument();
    expect(
      screen.getByText(/LauncherError: No active account\./),
    ).toBeInTheDocument();
  });

  test("makes a URL in the message clickable", () => {
    render(
      <SystemErrorSection
        systemErrorExceptionFull={withMessage(
          "No account. Sign in at https://example.test/setup to create one.",
        )}
      />,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://example.test/setup");
    expect(link).toHaveAttribute("target", "_blank");
  });

  test("renders nothing without a system error", () => {
    const { container } = render(
      <SystemErrorSection systemErrorExceptionFull={undefined} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
