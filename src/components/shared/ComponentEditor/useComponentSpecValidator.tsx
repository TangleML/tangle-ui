import { useSuspenseQuery } from "@tanstack/react-query";

import { componentSpecValidatorQuery } from "@/services/componentSpecValidation";

export const useComponentSpecValidator = () => {
  const { data: validator } = useSuspenseQuery(componentSpecValidatorQuery);
  return validator;
};
