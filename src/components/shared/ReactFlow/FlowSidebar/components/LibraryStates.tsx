import { SidebarMenuItem } from "@/components/ui/sidebar";

export const LoadingState = () => (
  <SidebarMenuItem>
    <div className="animate-pulse flex space-x-2 items-center">
      <div className="h-4 w-4 bg-gray-200 rounded-full"></div>
      <div className="h-3 bg-gray-200 rounded w-full"></div>
    </div>
  </SidebarMenuItem>
);

export const ErrorState = ({ message }: { message: string }) => (
  <SidebarMenuItem className="text-red-500">Error: {message}</SidebarMenuItem>
);
