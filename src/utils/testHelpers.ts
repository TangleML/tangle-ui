import type { DynamicDataArgument, InputSpec } from "./componentSpec";

export function makeSecretArg(name: string): DynamicDataArgument {
  return { dynamicData: { secret: { name } } };
}

export function makeInput(name: string, optional = false): InputSpec {
  return { name, optional };
}
