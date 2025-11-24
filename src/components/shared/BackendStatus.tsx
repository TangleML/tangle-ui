import { Database } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useBackend } from "@/providers/BackendProvider";

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

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleOpen}
            className="bg-none hover:opacity-80"
            size="icon"
          >
            <div className="relative">
              <Database className="h-4 w-4 text-white shrink-0" />
              <span
                className={cn(
                  "absolute -bottom-px -right-px w-2 h-2 rounded-full border border-slate-900",
                  configured ? configuredStatusColor : notConfiguredStatusColor,
                )}
              />
            </div>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {available ? backendAvailableString : backendNotAvailableString}
        </TooltipContent>
      </Tooltip>

      <BackendConfigurationDialog open={open} setOpen={setOpen} />
    </>
  );
};

export default BackendStatus;
