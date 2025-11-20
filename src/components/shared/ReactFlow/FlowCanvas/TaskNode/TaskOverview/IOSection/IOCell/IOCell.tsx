import { useCallback, useEffect, useRef, useState } from "react";

import type { ArtifactDataResponse } from "@/api/types.gen";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import type { InputSpec, OutputSpec } from "@/utils/componentSpec";
import { copyToClipboard } from "@/utils/string";

import IOCellDetails from "./IOCellDetails";
import IOCellHeader from "./IOCellHeader";

interface IOCellProps {
  io: InputSpec | OutputSpec;
  artifactData: ArtifactDataResponse | null | undefined;
}

export interface IOCellCopyState {
  isCopied: boolean;
  isTooltipOpen: boolean;
  copyType?: "Name" | "Value";
}

export interface IOCellActions {
  handleCopyName: () => void;
  handleCopyValue: () => void;
  handleTooltipOpen: (open: boolean) => void;
}

const IOCell = ({ io, artifactData }: IOCellProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);
  const [copyType, setCopyType] = useState<"Name" | "Value">();
  const [isOpen, setIsOpen] = useState(false);
  const tooltipTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleTooltipOpen = useCallback((open: boolean) => {
    // When the tooltip is closed, we need to clear the copied state
    if (!open) {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      setIsCopied(false);
    }
    setIsTooltipOpen(open);
  }, []);

  const handleCopy = useCallback((value: string, type: "Name" | "Value") => {
    copyToClipboard(value);
    setIsCopied(true);
    setIsTooltipOpen(true);
    setCopyType(type);

    // Clear any existing timer
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);

    tooltipTimerRef.current = setTimeout(() => {
      setIsTooltipOpen(false);
      setCopyType(undefined);
      setIsCopied(false);
    }, 1500);
  }, []);

  const handleCopyName = useCallback(() => {
    handleCopy(io.name, "Name");
  }, [io.name, handleCopy]);

  const handleCopyValue = useCallback(() => {
    if (!artifactData?.value) return;

    handleCopy(artifactData.value, "Value");
  }, [artifactData, handleCopy]);

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    };
  }, []);

  const copyState: IOCellCopyState = {
    isCopied,
    isTooltipOpen,
    copyType,
  };

  const actions: IOCellActions = {
    handleCopyName,
    handleCopyValue,
    handleTooltipOpen,
  };

  return (
    <Collapsible
      key={io.name}
      open={isOpen}
      onOpenChange={setIsOpen}
      className="w-full"
    >
      <IOCellHeader
        io={io}
        artifactData={artifactData}
        copyState={copyState}
        actions={actions}
        isOpen={isOpen}
      />

      {artifactData && (
        <CollapsibleContent>
          <IOCellDetails
            io={io}
            artifactData={artifactData}
            actions={actions}
          />
        </CollapsibleContent>
      )}
    </Collapsible>
  );
};

export default IOCell;
