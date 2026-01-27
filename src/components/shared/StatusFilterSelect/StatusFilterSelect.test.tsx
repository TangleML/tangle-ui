import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StatusFilterSelect } from "./StatusFilterSelect";

describe("StatusFilterSelect", () => {
  describe("rendering", () => {
    it("should render with default placeholder when no value", () => {
      render(<StatusFilterSelect value={undefined} onChange={vi.fn()} />);

      expect(screen.getByRole("combobox")).toBeInTheDocument();
      expect(screen.getByText("All statuses")).toBeInTheDocument();
    });

    it("should render with Running status", () => {
      render(<StatusFilterSelect value="RUNNING" onChange={vi.fn()} />);

      expect(screen.getByText("Running")).toBeInTheDocument();
    });

    it("should render with Succeeded status", () => {
      render(<StatusFilterSelect value="SUCCEEDED" onChange={vi.fn()} />);

      expect(screen.getByText("Succeeded")).toBeInTheDocument();
    });

    it("should render with Failed status", () => {
      render(<StatusFilterSelect value="FAILED" onChange={vi.fn()} />);

      expect(screen.getByText("Failed")).toBeInTheDocument();
    });

    it("should render with Pending status", () => {
      render(<StatusFilterSelect value="PENDING" onChange={vi.fn()} />);

      expect(screen.getByText("Pending")).toBeInTheDocument();
    });

    it("should render with Cancelled status", () => {
      render(<StatusFilterSelect value="CANCELLED" onChange={vi.fn()} />);

      expect(screen.getByText("Cancelled")).toBeInTheDocument();
    });

    it("should render with System error status", () => {
      render(<StatusFilterSelect value="SYSTEM_ERROR" onChange={vi.fn()} />);

      expect(screen.getByText("System error")).toBeInTheDocument();
    });
  });
});
