import { Text } from "@/components/ui/typography";

export const LoadingState = () => (
  <li className="px-2 py-1.5">
    <div className="animate-pulse flex space-x-2 items-center">
      <div className="h-4 w-4 bg-gray-200 rounded-full"></div>
      <div className="h-3 bg-gray-200 rounded w-full"></div>
    </div>
  </li>
);

export const ErrorState = ({ message }: { message: string }) => (
  <li className="px-2 py-1.5">
    <Text tone="critical">Error: {message}</Text>
  </li>
);

export const EmptyState = () => (
  <li className="px-2 py-1.5">
    <Text tone="subdued">No components found</Text>
  </li>
);
