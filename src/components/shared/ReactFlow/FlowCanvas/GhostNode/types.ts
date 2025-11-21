export interface GhostNodeData extends Record<string, unknown> {
  ioType: "input" | "output";
  label: string;
  dataType?: string;
  value?: string;
  defaultValue?: string;
  connectedTaskLabel?: string;
  connectedOutputName?: string;
}
