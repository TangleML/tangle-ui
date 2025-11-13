import type { ComponentSpec, GraphSpec } from "./componentSpec";

const makeNameUniqueByAddingIndex = (
  name: string,
  existingNames: Set<string>,
): string => {
  let finalName = name;
  let index = 1;
  while (existingNames.has(finalName)) {
    index++;
    finalName = name + " " + index.toString();
  }
  return finalName;
};

export const getUniqueInputName = (
  componentSpec: ComponentSpec,
  name: string = "Input",
) => {
  return makeNameUniqueByAddingIndex(
    name,
    new Set(componentSpec.inputs?.map((inputSpec) => inputSpec.name)),
  );
};

export const getUniqueOutputName = (
  componentSpec: ComponentSpec,
  name: string = "Output",
) => {
  return makeNameUniqueByAddingIndex(
    name,
    new Set(componentSpec.outputs?.map((outputSpec) => outputSpec.name)),
  );
};

export const getUniqueTaskName = (
  graphSpec: GraphSpec,
  name: string = "Task",
) => {
  return makeNameUniqueByAddingIndex(
    name,
    new Set(Object.keys(graphSpec.tasks)),
  );
};

export const getUniqueName = (names: string[], name: string = "Untitled") => {
  return makeNameUniqueByAddingIndex(name, new Set(names));
};

export const validateTaskName = (
  name: string,
  graphSpec: GraphSpec,
  checkId = false,
): string | null => {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return "Name cannot be empty";
  }

  if (checkId && new Set(Object.keys(graphSpec.tasks)).has(trimmedName)) {
    return "A task with this id already exists";
  }

  if (
    new Set(
      Object.values(graphSpec.tasks).map(
        (task) => task.componentRef.spec?.name,
      ),
    ).has(trimmedName)
  ) {
    return "A task with this name already exists";
  }

  if (!/^[a-zA-Z0-9 _-]+$/.test(trimmedName)) {
    return "Name cannot contain special characters";
  }

  return null;
};
