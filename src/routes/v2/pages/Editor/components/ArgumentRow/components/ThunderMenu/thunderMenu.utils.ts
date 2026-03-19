import type {
  ComponentSpec,
  ComponentSpecJson,
  TypeSpecType,
} from "@/models/componentSpec";

export interface QuickConnectPort {
  entityId: string;
  portName: string;
  portType?: TypeSpecType;
}

export interface QuickConnectGroup {
  key: string;
  label: string;
  icon: "Download" | "Workflow";
  ports: QuickConnectPort[];
}

function isTypeCompatible(
  sourceType: TypeSpecType | undefined,
  targetType: TypeSpecType | undefined,
): boolean {
  if (!sourceType || !targetType) return true;
  if (typeof sourceType === "string" && sourceType.toLowerCase() === "any")
    return true;
  if (typeof targetType === "string" && targetType.toLowerCase() === "any")
    return true;
  if (typeof sourceType === "string" && typeof targetType === "string") {
    return sourceType.toLowerCase() === targetType.toLowerCase();
  }
  return JSON.stringify(sourceType) === JSON.stringify(targetType);
}

export function getQuickConnectGroups(
  spec: ComponentSpec | null,
  inputType: TypeSpecType | undefined,
  excludeEntityIds: string[],
): QuickConnectGroup[] {
  if (!spec) return [];

  const excludeSet = new Set(excludeEntityIds);
  const groups: QuickConnectGroup[] = [];

  const compatibleInputs = spec.inputs.filter(
    (input) =>
      !excludeSet.has(input.$id) && isTypeCompatible(input.type, inputType),
  );
  if (compatibleInputs.length > 0) {
    groups.push({
      key: "__graph_inputs__",
      label: "Graph Inputs",
      icon: "Download",
      ports: compatibleInputs.map((input) => ({
        entityId: input.$id,
        portName: input.name,
        portType: input.type,
      })),
    });
  }

  for (const task of spec.tasks) {
    if (excludeSet.has(task.$id)) continue;

    const componentSpec = task.componentRef.spec as
      | ComponentSpecJson
      | undefined;
    const outputs = componentSpec?.outputs ?? [];

    const compatibleOutputs = outputs.filter((output) =>
      isTypeCompatible(output.type, inputType),
    );

    if (compatibleOutputs.length > 0) {
      groups.push({
        key: task.$id,
        label: task.name,
        icon: "Workflow",
        ports: compatibleOutputs.map((output) => ({
          entityId: task.$id,
          portName: output.name,
          portType: output.type,
        })),
      });
    }
  }

  return groups;
}

export function typeSpecToString(typeSpec?: TypeSpecType): string {
  if (typeSpec === undefined) return "";
  if (typeof typeSpec === "string") return typeSpec;
  return JSON.stringify(typeSpec);
}
