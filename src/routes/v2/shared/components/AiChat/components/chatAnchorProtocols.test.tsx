import type { AnchorProtocolProps } from "@tangent/embed-react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { chatAnchorProtocols } from "./chatAnchorProtocols";

const revealEntity = vi.fn();
let reveal: { revealEntity: typeof revealEntity } | null = null;

vi.mock("./ChatEntityRevealContext", () => ({
  useOptionalChatEntityReveal: () => reveal,
}));

vi.mock("./ChatEntityChip", () => ({
  ChatEntityChip: ({
    icon,
    label,
    onClick,
  }: {
    icon: string;
    label: string;
    onClick?: () => void;
  }) => (
    <button data-testid="chip" data-icon={icon} onClick={onClick}>
      {label}
    </button>
  ),
}));

vi.mock("./ComponentChipFromContext", () => ({
  ComponentChipFromContext: ({
    componentId,
    label,
  }: {
    componentId: string;
    label: string;
  }) => (
    <span data-testid="component-anchor" data-id={componentId}>
      {label}
    </span>
  ),
}));

const EntityAnchor = chatAnchorProtocols.entity;
const ComponentAnchor = chatAnchorProtocols.component;

function anchorProps(
  overrides: Partial<AnchorProtocolProps>,
): AnchorProtocolProps {
  return {
    href: "entity://task_1",
    protocol: "entity",
    path: "task_1",
    label: "Load CSV",
    ...overrides,
  };
}

describe("chatAnchorProtocols entity anchor", () => {
  beforeEach(() => {
    revealEntity.mockReset();
    reveal = null;
  });

  it("renders a chip whose icon is inferred from the id prefix", () => {
    render(
      <EntityAnchor {...anchorProps({ path: "input_1", label: "rows" })} />,
    );

    expect(screen.getByTestId("chip")).toHaveAttribute(
      "data-icon",
      "ArrowRightToLine",
    );
  });

  it("delegates the click to the reveal context when present", () => {
    reveal = { revealEntity };

    render(<EntityAnchor {...anchorProps({})} />);
    fireEvent.click(screen.getByTestId("chip"));

    expect(revealEntity).toHaveBeenCalledWith("task_1", "Load CSV");
  });

  it("is an inert no-op click when no reveal context is provided", () => {
    render(<EntityAnchor {...anchorProps({})} />);
    fireEvent.click(screen.getByTestId("chip"));

    expect(revealEntity).not.toHaveBeenCalled();
  });
});

describe("chatAnchorProtocols component anchor", () => {
  it("renders a component chip from the href path", () => {
    render(
      <ComponentAnchor
        {...anchorProps({
          href: "component://digest-1",
          protocol: "component",
          path: "digest-1",
          label: "Trainer",
        })}
      />,
    );

    const anchor = screen.getByTestId("component-anchor");
    expect(anchor).toHaveTextContent("Trainer");
    expect(anchor).toHaveAttribute("data-id", "digest-1");
  });
});
