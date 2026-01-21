import {
  Sidebar,
  SidebarContent,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";

import FileActions from "./sections/FileActions";
import GraphComponents from "./sections/GraphComponents";
import RunsAndSubmission from "./sections/RunsAndSubmission";

const FlowSidebar = () => {
  const { open, setOpen } = useSidebar();
  const { currentSubgraphPath } = useComponentSpec();

  const isViewingSubgraph = currentSubgraphPath.length > 1;

  const sidebarTriggerClasses = cn(
    "absolute z-1 transition-all duration-300 bg-white mt-8 rounded-r-md shadow-md p-0.5 pr-1",
    open ? "left-[255px]" : "left-[47px]",
    isViewingSubgraph ? "top-[65px]" : "top-6",
  );

  return (
    <>
      <div className={sidebarTriggerClasses}>
        <SidebarTrigger
          className="text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          onClick={() => setOpen(!open)}
        />
      </div>
      <Sidebar
        side="left"
        className="mt-14 h-[calc(100vh-56px)]"
        collapsible="icon"
      >
        <SidebarContent className="gap-0! m-0! p-0!">
          <FileActions isOpen={open} />
          <RunsAndSubmission isOpen={open} />
          <GraphComponents isOpen={open} />
        </SidebarContent>
      </Sidebar>
    </>
  );
};

export default FlowSidebar;
