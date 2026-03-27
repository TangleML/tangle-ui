import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

import { useConnectFolder } from "../hooks/useFolderMutations";

const isSupported = "showDirectoryPicker" in window;

export function ConnectFolderButton() {
  const connectFolder = useConnectFolder();

  if (!isSupported) return null;

  return (
    <Button
      variant="outline"
      className="gap-2 rounded-lg px-3 py-2 text-sm"
      onClick={() => connectFolder.mutate()}
      disabled={connectFolder.isPending}
    >
      <Icon name="HardDrive" size="lg" />
      Connect Folder
    </Button>
  );
}
