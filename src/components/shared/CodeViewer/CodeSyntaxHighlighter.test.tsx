import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

// Mock Monaco to render plain text so we can assert on content
vi.mock("@monaco-editor/react", () => ({
  default: ({ defaultValue }: { defaultValue: string }) => (
    <pre data-testid="monaco-mock">{defaultValue}</pre>
  ),
}));

import CodeSyntaxHighlighter from "./CodeSyntaxHighlighter";

const sampleCode = `function hello() {
  console.log("Hello, World!");
  return true;
}`;

describe("<CodeSyntaxHighlighter />", () => {
  test("renders basic code with default props", () => {
    render(<CodeSyntaxHighlighter code={sampleCode} language="javascript" />);

    expect(screen.getByTestId("monaco-mock")).toHaveTextContent("function");
  });
});
