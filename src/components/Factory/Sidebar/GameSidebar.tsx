import { Sidebar, SidebarContent } from "@/components/ui/sidebar";

import Buildings from "./Buildings";
import GlobalResources from "./GlobalResources";
import { Time } from "./Time";

interface GameSidebarProps {
  day: number;
  onAdvanceDay: () => void;
}

const GameSidebar = ({ day, onAdvanceDay }: GameSidebarProps) => {
  return (
    <Sidebar
      side="left"
      className="mt-14 h-[calc(100vh-56px)] z-100"
      collapsible="icon"
    >
      <SidebarContent>
        <Time day={day} onAdvanceDay={onAdvanceDay} />
        <GlobalResources />
        <Buildings />
      </SidebarContent>
    </Sidebar>
  );
};

export default GameSidebar;
