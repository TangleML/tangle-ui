import { type ComponentSpec } from "@/utils/componentSpec";

export const checkNameCollision = (
  newName: string,
  currentIOName: string,
  componentSpec: ComponentSpec,
  type: "inputs" | "outputs",
) => {
  if (!componentSpec[type]) return false;

  return componentSpec[type].some(
    (IO) =>
      IO.name.toLowerCase() === newName.toLowerCase() &&
      IO.name.toLowerCase() !== currentIOName.toLowerCase(),
  );
};
