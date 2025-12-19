export const isScalar = (
  argument: unknown,
): argument is string | number | boolean | null | undefined => {
  return (
    typeof argument === "string" ||
    typeof argument === "number" ||
    typeof argument === "boolean" ||
    argument === null ||
    argument === undefined
  );
};
