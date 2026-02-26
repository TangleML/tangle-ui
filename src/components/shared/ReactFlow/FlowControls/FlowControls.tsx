import {
  ControlButton,
  type ControlProps,
  Controls,
  type ReactFlowProps,
} from "@xyflow/react";
import {
  LockKeyhole,
  LockKeyholeOpen,
  SquareDashedMousePointerIcon,
} from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import type { LayoutAlgorithm } from "../FlowCanvas/utils/autolayout";

interface FlowControlsProps extends ControlProps {
  config: ReactFlowProps;
  updateConfig: (config: Partial<ReactFlowProps>) => void;
  onAutoLayout?: (algorithm: LayoutAlgorithm) => void;
}

const LAYOUT_ALGORITHMS: {
  value: LayoutAlgorithm;
  label: string;
  description: string;
}[] = [
  { value: "sugiyama", label: "Sugiyama", description: "Layered" },
  {
    value: "sugiyama_centered",
    label: "Sugiyama Centered",
    description: "Centered",
  },
  { value: "digco", label: "Digco", description: "Compact" },
  { value: "dwyer", label: "Dwyer", description: "Organic" },
];

export default function FlowControls({
  config,
  updateConfig,
  onAutoLayout,
  ...props
}: FlowControlsProps) {
  const [multiSelectActive, setMultiSelectActive] = useState(false);
  const [lockActive, setLockActive] = useState(!config.nodesDraggable);
  const [layoutPopoverOpen, setLayoutPopoverOpen] = useState(false);
  const [isLayouting, setIsLayouting] = useState(false);

  const onClickMultiSelect = useCallback(() => {
    updateConfig({
      selectionOnDrag: !multiSelectActive,
      panOnDrag: multiSelectActive,
    });
    setMultiSelectActive(!multiSelectActive);
  }, [multiSelectActive, updateConfig]);

  const handleLockChange = useCallback(() => {
    updateConfig({
      nodesDraggable: lockActive,
    });
    setLockActive(!lockActive);
  }, [lockActive, updateConfig]);

  const handleLayoutSelect = async (algorithm: LayoutAlgorithm) => {
    setIsLayouting(true);
    setLayoutPopoverOpen(false);

    // Delay subsequent execution to the next frame to ensure the popover has closed and the loading spinner has rendered
    await new Promise((resolve) => requestAnimationFrame(resolve));

    try {
      await onAutoLayout?.(algorithm);
    } finally {
      setIsLayouting(false);
    }
  };

  return (
    <Controls {...props}>
      {!props.showInteractive && (
        <ControlButton
          onClick={handleLockChange}
          className={cn(lockActive && "bg-gray-100!")}
        >
          {lockActive ? (
            <LockKeyhole className="fill-none! -scale-x-120 scale-y-120" />
          ) : (
            <LockKeyholeOpen className="fill-none! -scale-x-120 scale-y-120" />
          )}
        </ControlButton>
      )}
      <ControlButton
        onClick={onClickMultiSelect}
        className={cn(multiSelectActive && "bg-gray-100!")}
      >
        <SquareDashedMousePointerIcon className="scale-120" />
      </ControlButton>
      {onAutoLayout && (
        <Popover open={layoutPopoverOpen} onOpenChange={setLayoutPopoverOpen}>
          <PopoverTrigger asChild>
            <ControlButton disabled={isLayouting}>
              {isLayouting ? (
                <Spinner className="fill-none! scale-120" />
              ) : (
                <Icon name="LayoutGrid" className="stroke-none scale-120" />
              )}
            </ControlButton>
          </PopoverTrigger>
          <PopoverContent className="w-fit p-2" align="end" side="right">
            <BlockStack gap="1">
              <Text size="sm" className="ml-1">
                Auto Layout
              </Text>
              {LAYOUT_ALGORITHMS.map((algo) => (
                <Button
                  key={algo.value}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => handleLayoutSelect(algo.value)}
                  disabled={isLayouting}
                >
                  <Text>{algo.label}</Text>
                  <Text tone="subdued">({algo.description})</Text>
                </Button>
              ))}
            </BlockStack>
          </PopoverContent>
        </Popover>
      )}
    </Controls>
  );
}
