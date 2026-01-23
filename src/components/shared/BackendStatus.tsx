import { Database } from "lucide-react";
import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";
import { useBackend } from "@/providers/BackendProvider";

import TooltipButton from "./Buttons/TooltipButton";
import BackendConfigurationDialog from "./Dialogs/BackendConfigurationDialog";

const BackendStatus = () => {
  const { available, backendUrl, isConfiguredFromEnv, configured } =
    useBackend();

  const [open, setOpen] = useState(false);

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const backendAvailableString = isConfiguredFromEnv
    ? "Backend available"
    : `Connected to ${backendUrl}`;
  const backendNotAvailableString = configured
    ? "Backend unavailable"
    : "Backend not configured";

  const configuredStatusColor = available ? "bg-green-500" : "bg-red-500";
  const notConfiguredStatusColor = "bg-yellow-500";

  const tooltipText = available
    ? backendAvailableString
    : backendNotAvailableString;

  return (
    <>
      <TooltipButton
        variant="ghost"
        size="icon"
        className="text-white hover:bg-white/10"
        tooltip={tooltipText}
        onClick={handleOpen}
        data-testid="backend-status-button"
      >
        <div className="relative">
          <Database className="h-4 w-4 shrink-0" />
          <span
            className={cn(
              "absolute -bottom-px -right-px w-2 h-2 rounded-full border border-slate-900",
              configured ? configuredStatusColor : notConfiguredStatusColor,
            )}
          />
        </div>
      </TooltipButton>

      <BackendConfigurationDialog open={open} setOpen={setOpen} />
    </>
  );
};

export default BackendStatus;
