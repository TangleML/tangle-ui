import type { ComponentSpec } from "@/models/componentSpec";

export function resolveConnectedPortNames(
  entityId: string,
  spec: ComponentSpec | null,
): { inputs: Set<string>; outputs: Set<string> } {
  const inputs = new Set<string>();
  const outputs = new Set<string>();

  if (!spec) return { inputs, outputs };

  for (const binding of spec.bindings) {
    if (binding.targetEntityId === entityId) {
      inputs.add(binding.targetPortName);
    }
    if (binding.sourceEntityId === entityId) {
      outputs.add(binding.sourcePortName);
    }
  }

  return { inputs, outputs };
}

export function condensePorts<TPort extends { name: string }>(
  ports: TPort[],
  connectedNames: ReadonlySet<string>,
): TPort[] {
  const connected = ports.filter((port) => connectedNames.has(port.name));
  return connected.length > 0 ? connected : ports.slice(0, 1);
}
