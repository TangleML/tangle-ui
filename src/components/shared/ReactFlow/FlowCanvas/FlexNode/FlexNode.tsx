import { type Node, type NodeProps } from "@xyflow/react";
import { useEffect } from "react";

import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { useContextPanel } from "@/providers/ContextPanelProvider";

import { FlexNodeEditor } from "./FlexNodeEditor";
import type { FlexNodeData } from "./types";

type FlexNodeProps = NodeProps<Node<FlexNodeData>>;

const FlexNode = ({ data, id, selected }: FlexNodeProps) => {
  const { properties, readOnly } = data;
  const { color, zIndex } = properties;

  const {
    setContent,
    clearContent,
    setOpen: setContextPanelOpen,
  } = useContextPanel();

  useEffect(() => {
    if (selected) {
      setContent(<FlexNodeEditor flexNode={data} readOnly={readOnly} />);
      setContextPanelOpen(true);
    }

    return () => {
      if (selected) {
        clearContent();
      }
    };
  }, [data, readOnly, selected]);

  return (
    <div
      key={id}
      className={cn(
        "p-1 rounded-lg border border-gray-200 h-full w-full",
        selected && "ring-2 ring-gray-500",
      )}
      style={{ backgroundColor: color, zIndex }}
    >
      <div className="rounded-sm bg-white/40 p-1 h-full w-full">
        <Paragraph size="sm" weight="semibold" className="mb-1">
          {properties.title}
        </Paragraph>
        <Paragraph size="xs">{properties.content}</Paragraph>
      </div>
    </div>
  );
};

export default FlexNode;
