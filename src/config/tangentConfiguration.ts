import tangentConfiguration from "@/config/tangentConfiguration.json";

interface VsCodeExtensionSettingsUiConfig {
  description: string;
  steps: string[];
}

interface AttachLocalAgentButtonUiConfig {
  dialogDescription: string;
  commandInstructions: string;
}

interface TangentConfiguration {
  ui: {
    VsCodeExtensionSettings: VsCodeExtensionSettingsUiConfig;
    AttachLocalAgentButton: AttachLocalAgentButtonUiConfig;
  };
}

export const TANGENT_CONFIG: TangentConfiguration = tangentConfiguration;
