import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Tabs, TabsList, TabsTrigger } from "./tabs";

function renderTab(variant?: "default" | "line") {
  render(
    <Tabs defaultValue="chat">
      <TabsList variant={variant}>
        <TabsTrigger value="chat">Chat</TabsTrigger>
      </TabsList>
    </Tabs>,
  );
  return screen.getByRole("tab", { name: "Chat" });
}

describe("TabsTrigger", () => {
  it("draws a line tab's focus ring inside the tab, where its strip can't clip it", () => {
    expect(renderTab("line")).toHaveClass("focus-visible:ring-inset");
  });

  it("leaves a segmented tab's focus ring around it", () => {
    expect(renderTab()).not.toHaveClass("focus-visible:ring-inset");
  });
});
