export const getNodeTypeColor = (nodeType: string | undefined): string => {
  switch (nodeType) {
    case "input":
      return "bg-blue-500";
    case "output":
      return "bg-violet-500";
    case "task":
    default:
      return "bg-gray-500";
  }
};
