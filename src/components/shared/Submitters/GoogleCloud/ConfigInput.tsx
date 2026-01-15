import { RefreshCcw } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";

import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { GoogleCloudSubmitterConfiguration } from "@/hooks/useGoogleCloudSubmitter";
import { cn } from "@/lib/utils";

import TooltipButton from "../../Buttons/TooltipButton";

interface ConfigInputProps {
  config: GoogleCloudSubmitterConfiguration;
  projectList?: string[];
  onChange: (project: Partial<GoogleCloudSubmitterConfiguration>) => void;
  refreshProjectList?: () => void;
}

export const ConfigInput = ({
  config,
  projectList,
  onChange,
  refreshProjectList,
}: ConfigInputProps) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleInputChange = (value: string) => {
    onChange({ projectId: value });
  };

  const handleSelect = (projectId: string) => {
    onChange({ projectId });
    setOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") {
      setOpen(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const hasProjects = projectList && projectList.length > 0;

  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-semibold">Project Id</p>
      <div className="flex items-center gap-2 mb-1">
        <div className="relative w-full" ref={containerRef}>
          <Command shouldFilter={false} className="w-full py-1">
            <CommandInput
              placeholder="<my-project-id>"
              value={config.projectId}
              onValueChange={handleInputChange}
              onFocus={() => setOpen(true)}
              onKeyDown={handleKeyDown}
              disabled={!config.googleCloudOAuthClientId}
              autoComplete="off"
              underlined={false}
              autoFocus={!!config.googleCloudOAuthClientId}
              className={cn(
                "w-full border rounded-md px-3 py-2 text-sm bg-background",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors",
              )}
            />
            {open && (
              <div
                className={cn(
                  "absolute left-0 top-full mt-1 w-full z-50 bg-popover border rounded-md shadow-lg",
                  "max-h-60 overflow-y-auto",
                )}
              >
                <CommandList>
                  <CommandGroup heading="Your Cloud Projects">
                    {hasProjects ? (
                      projectList.map((projectId) => (
                        <CommandItem
                          key={projectId}
                          value={projectId}
                          onSelect={() => handleSelect(projectId)}
                          className={cn(
                            "cursor-pointer px-4 py-2 transition-colors",
                            "hover:bg-accent hover:text-accent-foreground",
                            projectId === config.projectId &&
                              "bg-accent text-accent-foreground",
                          )}
                        >
                          {projectId}
                        </CommandItem>
                      ))
                    ) : (
                      <div className="p-2 text-muted-foreground text-sm">
                        No projects
                      </div>
                    )}
                  </CommandGroup>
                </CommandList>
              </div>
            )}
          </Command>
        </div>
        <TooltipButton
          onClick={refreshProjectList}
          variant="outline"
          size="icon"
          disabled={!config.googleCloudOAuthClientId}
          tooltip="Refresh Project List"
        >
          <RefreshCcw />
        </TooltipButton>
      </div>
    </div>
  );
};
