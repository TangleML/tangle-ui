import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon, type IconName } from "@/components/ui/icon";
import { useConnectGoogleDriveFolder } from "@/services/googleDrive/useConnectGoogleDriveFolder"; // google-drive

import { useConnectFolder } from "../hooks/useFolderMutations";

const isLocalFsAvailable = "showDirectoryPicker" in window;

const isGoogleDriveAvailable =
  !!import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  !!import.meta.env.VITE_GOOGLE_API_KEY;

interface DriverOption {
  id: string;
  label: string;
  icon: IconName;
  action: () => void;
  isPending: boolean;
}

export function ConnectFolderButton() {
  const connectFolder = useConnectFolder();
  const connectGoogleDrive = useConnectGoogleDriveFolder(); // google-drive

  const drivers: DriverOption[] = [];

  if (isLocalFsAvailable) {
    drivers.push({
      id: "local-fs",
      label: "Connect Folder",
      icon: "HardDrive",
      action: () => connectFolder.mutate(),
      isPending: connectFolder.isPending,
    });
  }

  if (isGoogleDriveAvailable) {
    drivers.push({
      id: "google-drive",
      label: "Google Drive",
      icon: "Cloud",
      action: () => connectGoogleDrive.mutate(),
      isPending: connectGoogleDrive.isPending,
    });
  }

  if (drivers.length === 0) return null;

  const isPending = drivers.some((d) => d.isPending);
  const primary = drivers[0];

  if (drivers.length === 1) {
    return (
      <Button
        variant="outline"
        className="gap-2 px-3 py-2 text-sm"
        onClick={primary.action}
        disabled={isPending}
      >
        <Icon name={primary.icon} size="lg" />
        {primary.label}
      </Button>
    );
  }

  return (
    <div className="flex items-center">
      <Button
        variant="outline"
        className="gap-2 rounded-r-none border-r-0 px-3 py-2 text-sm"
        onClick={primary.action}
        disabled={isPending}
      >
        <Icon name={primary.icon} size="lg" />
        {primary.label}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="rounded-l-none px-1.5 py-2"
            disabled={isPending}
          >
            <Icon name="ChevronDown" size="sm" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {drivers.map((driver) => (
            <DropdownMenuItem
              key={driver.id}
              onClick={driver.action}
              disabled={driver.isPending}
            >
              <Icon name={driver.icon} size="sm" />
              {driver.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
