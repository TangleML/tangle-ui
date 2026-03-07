import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { QueryParamType } from "@/types/composerSchema";

import { buildUrl, LinkBlock } from "./LinkBlock";

describe("buildUrl", () => {
  it("returns urlTemplate as-is when no queryParams", () => {
    expect(buildUrl("https://example.com/query")).toBe(
      "https://example.com/query",
    );
  });

  it("returns urlTemplate as-is when queryParams is empty", () => {
    expect(buildUrl("https://example.com/query", {})).toBe(
      "https://example.com/query",
    );
  });

  it("appends string queryParams", () => {
    const url = buildUrl("https://example.com/query", {
      category: { type: QueryParamType.String, value: "logging" },
    });
    expect(url).toBe("https://example.com/query?category=logging");
  });

  it("serializes JSON queryParams", () => {
    const url = buildUrl("https://example.com/query", {
      r: {
        type: QueryParamType.Json,
        value: { from: "2026-03-01", to: "2026-03-02" },
      },
    });
    expect(url).toContain("r=");
    const parsed = new URL(url);
    expect(JSON.parse(parsed.searchParams.get("r")!)).toEqual({
      from: "2026-03-01",
      to: "2026-03-02",
    });
    expect(url).toBe(
      "https://example.com/query?r=%7B%22from%22%3A%222026-03-01%22%2C%22to%22%3A%222026-03-02%22%7D",
    );
  });

  it("handles mixed string and JSON params", () => {
    const url = buildUrl("https://example.com/query", {
      category: { type: QueryParamType.String, value: "logging" },
      q: {
        type: QueryParamType.Json,
        value: { datasets: ["catchall"], limit: 1000 },
      },
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("category")).toBe("logging");
    expect(JSON.parse(parsed.searchParams.get("q")!)).toEqual({
      datasets: ["catchall"],
      limit: 1000,
    });
    expect(url).toBe(
      "https://example.com/query?category=logging&q=%7B%22datasets%22%3A%5B%22catchall%22%5D%2C%22limit%22%3A1000%7D",
    );
  });

  it("URL-encodes special characters in string values", () => {
    const url = buildUrl("https://example.com", {
      filter: {
        type: QueryParamType.String,
        value: "name=test&type=all",
      },
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.get("filter")).toBe("name=test&type=all");
    expect(url).toBe("https://example.com?filter=name%3Dtest%26type%3Dall");
  });
});

describe("<LinkBlock />", () => {
  it("displays title as link text when title is provided", () => {
    render(
      <LinkBlock title="Pod Logs" urlTemplate="https://example.com/query" />,
    );
    const link = screen.getByRole("link", { name: "Pod Logs" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://example.com/query");
  });

  it("falls back to full URL and warns when no title is provided", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<LinkBlock urlTemplate="https://example.com/query" />);
    const link = screen.getByRole("link", {
      name: "https://example.com/query",
    });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://example.com/query");
    expect(warnSpy).toHaveBeenCalledWith(
      "LinkBlock: missing title, falling back to raw URL",
    );
    warnSpy.mockRestore();
  });

  it("displays title even when URL has query params", () => {
    render(
      <LinkBlock
        title="Pod Events"
        urlTemplate="https://example.com/query"
        queryParams={{
          category: { type: QueryParamType.String, value: "logging" },
        }}
      />,
    );
    const link = screen.getByRole("link", { name: "Pod Events" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      "href",
      "https://example.com/query?category=logging",
    );
  });
});
