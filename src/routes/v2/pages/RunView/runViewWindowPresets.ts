import type { ViewPreset } from "@/routes/v2/shared/windows/viewPresets";

export const RUN_TOOLS_WINDOW_ID = "run-tools";
export const RUN_DETAILS_WINDOW_ID = "run-details";
export const RUN_AI_ASSISTANT_WINDOW_ID = "run-ai-assistant-chat";

export const RUN_DEFAULT_VIEW_PRESET: ViewPreset = {
  label: "Default",
  description:
    "Run Tools and AI Assistant on the left, Run Details on the right",
  visible: new Set([
    RUN_TOOLS_WINDOW_ID,
    RUN_DETAILS_WINDOW_ID,
    RUN_AI_ASSISTANT_WINDOW_ID,
  ]),
  dockAreas: {
    left: [RUN_TOOLS_WINDOW_ID, RUN_AI_ASSISTANT_WINDOW_ID],
    right: [RUN_DETAILS_WINDOW_ID],
  },
};

export const RUN_VIEW_PRESETS: ViewPreset[] = [
  RUN_DEFAULT_VIEW_PRESET,
  {
    label: "Minimal",
    description: "Hide all run panels",
    visible: new Set<string>(),
  },
];
