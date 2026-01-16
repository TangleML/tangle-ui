// React Compiler: Directory-based incremental adoption
// Add directories here as they are cleaned up for compiler compatibility
// Sorted by useCallback/useMemo count (cleanup effort) - least to most
export const REACT_COMPILER_ENABLED_DIRS = [
  // ✅ Enabled
  "src/components/Home",
  "src/components/Editor",

  // 0 useCallback/useMemo - ready to enable
  "src/components/layout",
  "src/components/shared/ArtifactsList",
  "src/components/shared/Buttons",
  "src/components/shared/ContextPanel",
  "src/components/shared/ExecutionDetails",
  "src/components/shared/QuickStart",
  "src/components/shared/Status",
  "src/components/shared/CodeViewer",
  "src/components/shared/FullscreenElement",
  "src/components/shared/CopyText",
  "src/components/shared/TaskDetails",
  "src/components/shared/GitHubAuth",
  "src/components/shared/Authentication",
  "src/routes",
  "src/components/shared/ReactFlow/FlowCanvas/FlowCanvas.tsx",
  "src/components/shared/ComponentEditor",
  "src/components/shared/Settings",
  "src/components/shared/HuggingFaceAuth",
  "src/components/shared/GitHubLibrary",
  "src/hooks/useHandleEdgeSelection.ts",
  "src/hooks/useEdgeSelectionHighlight.ts",

  "src/components/shared/Submitters/Oasis/components",
  "src/components/shared/Submitters/GoogleCloud/ConfigInput.tsx",
  "src/components/shared/Submitters/GoogleCloud/GoogleCloudSubmitter.tsx",
  "src/components/shared/Submitters/GoogleCloud/RegionInput.tsx",
  "src/components/shared/Submitters/Oasis/components/SubmitTaskArgumentsDialog.tsx",
  "src/components/shared/Submitters/Oasis/OasisSubmitter.tsx",
  "src/components/shared/PipelineDescription",
  "src/components/shared/InlineEditor",
  "src/components/shared/ManageComponent/PublishComponentButton.tsx",
  "src/components/shared/ManageComponent/DeprecatePublishedComponentButton.tsx",

  // 11-20 useCallback/useMemo
  // "src/components/ui",                         // 12
  // "src/components/PipelineRun",                // 14
  // "src/components/shared/ManageComponent",     // 15
  // "src/components/shared/Submitters",          // 16

  // 20+ useCallback/useMemo - significant cleanup needed
  // "src/components/shared/Dialogs",             // 31
  // "src/hooks",                                 // 53
  // "src/providers",                             // 75
  // "src/components/shared/ReactFlow", // 190
];

// Convert to glob patterns for ESLint
export const REACT_COMPILER_ENABLED_GLOBS = REACT_COMPILER_ENABLED_DIRS.map(
  (dir) => `${dir}/**/*.{ts,tsx}`,
);
