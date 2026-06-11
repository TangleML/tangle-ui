import { useState } from "react";

export function useYamlViewer() {
  const [yamlViewerOpen, setYamlViewerOpen] = useState(false);

  const openYamlViewer = () => {
    setYamlViewerOpen(true);
  };

  const closeYamlViewer = () => {
    setYamlViewerOpen(false);
  };

  return { yamlViewerOpen, openYamlViewer, closeYamlViewer };
}
