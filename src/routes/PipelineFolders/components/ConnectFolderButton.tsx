import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

import { useAddConnectedFolder } from "../hooks/useConnectedFolders";

const isSupported = "showDirectoryPicker" in window;

export function ConnectFolderButton() {
  const addFolder = useAddConnectedFolder();

  if (!isSupported) return null;

  return (
    <Button
      variant="outline"
      className="gap-2 rounded-lg px-3 py-2 text-sm"
      onClick={() => addFolder.mutate()}
      disabled={addFolder.isPending}
    >
      <Icon name="HardDrive" size="lg" />
      Connect Folder
    </Button>
  );
}
