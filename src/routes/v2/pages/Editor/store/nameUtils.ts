import type { ComponentSpec } from "@/models/componentSpec";

export function generateUniqueTaskName(
  spec: ComponentSpec,
  baseName: string,
): string {
  const existingNames = new Set(spec.tasks.map((t) => t.name));
  if (!existingNames.has(baseName)) return baseName;
  let counter = 2;
  while (existingNames.has(`${baseName} ${counter}`)) counter++;
  return `${baseName} ${counter}`;
}

export function generateUniqueInputName(
  spec: ComponentSpec,
  baseName = "Input",
): string {
  const existingNames = new Set(spec.inputs.map((i) => i.name));
  if (!existingNames.has(baseName)) return baseName;
  let counter = 2;
  while (existingNames.has(`${baseName} ${counter}`)) counter++;
  return `${baseName} ${counter}`;
}

export function generateUniqueOutputName(
  spec: ComponentSpec,
  baseName = "Output",
): string {
  const existingNames = new Set(spec.outputs.map((o) => o.name));
  if (!existingNames.has(baseName)) return baseName;
  let counter = 2;
  while (existingNames.has(`${baseName} ${counter}`)) counter++;
  return `${baseName} ${counter}`;
}
